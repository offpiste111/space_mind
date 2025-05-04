// CircleLayout.ts - レベルベースの円形レイアウトを実装

import * as THREE from 'three';

// ノード情報の型定義
interface NodeData {
    id: number;
    img?: string;
    name?: string;
    group?: number;
    x?: number;
    y?: number;
    z?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    size_x?: number;
    size_y?: number;
    [key: string]: any; // その他のプロパティを許容
}

// リンク情報の型定義
interface LinkData {
    index: number;
    source: NodeData;
    target: NodeData;
    [key: string]: any; // その他のプロパティを許容
}

// グラフデータの型定義
interface GraphData {
    nodes: NodeData[];
    links: LinkData[];
}

// CircleLayout内部で使用するノード情報拡張インターフェース
interface NodeInfo {
    node: NodeData;
    children: NodeInfo[];
    level: number;
    parent?: NodeInfo;
    x?: number;
    y?: number;
    width: number;
    height: number;
    // 円形レイアウト用のプロパティ
    angle?: number;    // 配置する角度（ラジアン）
    subtreeSize?: number; // サブツリーのサイズ（ノード数）
    subtreeAngle?: number; // サブツリーが占める角度範囲
    startAngle?: number;  // サブツリーの開始角度
    endAngle?: number;    // サブツリーの終了角度
}

/**
 * 階層的な円形レイアウトクラス
 * ノードをレベル（階層）ごとに同心円状に配置する
 */
export class CircleLayout {
    private graphData: GraphData;
    private nodeMap: Map<number, NodeInfo> = new Map();
    private rootNode: NodeInfo | null = null;
    private z_layer: number;
    private baseRadius: number = 200; // 基本半径
    private radiusIncrement: number = 200; // レベルごとの半径の増分
    private levelMap: Map<number, NodeInfo[]> = new Map(); // レベルごとのノード配列
    
    /**
     * コンストラクタ
     * @param graphData グラフデータ（ノードとリンク）
     * @param baseRadius 中心円の半径（未指定時はデフォルト値使用）
     * @param radiusIncrement レベルごとの半径の増分
     * @param z_layer Z軸の層の位置
     */
    constructor(graphData: GraphData, baseRadius?: number, radiusIncrement?: number, z_layer: number = -300) {
        this.graphData = graphData;
        this.z_layer = z_layer;
        if (baseRadius) this.baseRadius = baseRadius;
        if (radiusIncrement) this.radiusIncrement = radiusIncrement;
    }

    /**
     * レイアウトを実行し、ノードの位置を更新する
     * @returns 更新されたグラフデータ
     */
    public executeLayout(): GraphData {
        if (this.graphData.nodes.length === 0) {
            return this.graphData;
        }
        
        // ノードマップを初期化
        this.initializeNodeMap();
        
        // 親子関係を構築
        this.createParentChildRelationships();
        
        // ルートノードを特定
        this.findRootNode();
        
        if (!this.rootNode) {
            return this.graphData;
        }
        
        // レベル（階層）を割り当て
        this.assignLevels(this.rootNode, 0);
        
        // サブツリーのサイズを計算
        this.calculateSubtreeSizes(this.rootNode);
        
        // レベルごとのノードグループを作成
        this.groupNodesByLevel();
        
        // 系統ごとの角度範囲を割り当て
        this.assignAngleRanges();
        
        // ノードを同心円状に配置
        this.positionNodesInCircles();
        
        // ノードの位置を更新
        this.updateNodePositions();
        
        return this.graphData;
    }

    /**
     * ノードマップを初期化
     */
    private initializeNodeMap(): void {
        this.nodeMap.clear();
        this.graphData.nodes.forEach(node => {
            this.nodeMap.set(node.id, {
                node,
                children: [],
                level: 0,
                width: node.size_x || 120,
                height: node.size_y || 40
            });
        });
    }

    /**
     * 親子関係を作成
     */
    private createParentChildRelationships(): void {
        // ノードが既に親を持っているかをトラッキングするためのセット
        const nodesWithParents = new Set<number>();
        
        this.graphData.links.forEach(link => {
            const sourceId = link.source.id;
            const targetId = link.target.id;
            const sourceInfo = this.nodeMap.get(sourceId);
            const targetInfo = this.nodeMap.get(targetId);
            
            if (sourceInfo && targetInfo) {
                // ターゲットノードが既に親を持っていない場合のみ親子関係を追加
                if (!nodesWithParents.has(targetId)) {
                    sourceInfo.children.push(targetInfo);
                    targetInfo.parent = sourceInfo; // 親への参照を追加
                    nodesWithParents.add(targetId);
                }
            }
        });
    }

    /**
     * ルートノードを検索
     */
    private findRootNode(): void {
        // 親を持たないノードを探す
        let rootNodes: NodeInfo[] = [];
        this.nodeMap.forEach(nodeInfo => {
            if (!nodeInfo.parent) {
                rootNodes.push(nodeInfo);
            }
        });
        
        // ルートノードが見つからない場合は最初のノードを使用
        if (rootNodes.length === 0 && this.graphData.nodes.length > 0) {
            rootNodes = [this.nodeMap.get(this.graphData.nodes[0].id)!];
        } 
        // 複数のルートノードがある場合は、子孫の数が最も多いノードを選択
        else if (rootNodes.length > 1) {
            rootNodes.sort((a, b) => {
                const countDescendants = (nodeInfo: NodeInfo): number => {
                    let count = 0;
                    const queue = [...nodeInfo.children];
                    while (queue.length > 0) {
                        const current = queue.shift()!;
                        count++;
                        queue.push(...current.children);
                    }
                    return count;
                };
                
                return countDescendants(b) - countDescendants(a);
            });
        }
        
        this.rootNode = rootNodes[0] || null;
    }

    /**
     * ノードに階層レベルを割り当て
     * @param nodeInfo 処理するノード情報
     * @param level 階層レベル
     */
    private assignLevels(nodeInfo: NodeInfo, level: number): void {
        nodeInfo.level = level;
        nodeInfo.children.forEach(child => this.assignLevels(child, level + 1));
    }

    /**
     * サブツリーのサイズ（ノード数）を計算
     * @param nodeInfo 処理するノード情報
     * @returns サブツリーサイズ（ノード数）
     */
    private calculateSubtreeSizes(nodeInfo: NodeInfo): number {
        // 子ノードがない場合は自分自身のみ
        if (nodeInfo.children.length === 0) {
            nodeInfo.subtreeSize = 1;
            return 1;
        }
        
        // 子ノードのサブツリーサイズを合計
        let size = 1; // 自分自身もカウント
        nodeInfo.children.forEach(child => {
            size += this.calculateSubtreeSizes(child);
        });
        
        nodeInfo.subtreeSize = size;
        return size;
    }

    /**
     * レベルごとにノードをグループ化
     */
    private groupNodesByLevel(): void {
        this.levelMap.clear();
        
        this.nodeMap.forEach(nodeInfo => {
            if (!this.levelMap.has(nodeInfo.level)) {
                this.levelMap.set(nodeInfo.level, []);
            }
            this.levelMap.get(nodeInfo.level)!.push(nodeInfo);
        });
    }

    /**
     * 系統ごとの角度範囲を割り当て
     */
    private assignAngleRanges(): void {
        if (!this.rootNode || !this.rootNode.subtreeSize) {
            return;
        }
        
        // ルートノードは全体（2π）の角度範囲を持つ
        this.rootNode.startAngle = 0;
        this.rootNode.endAngle = Math.PI * 2;
        this.rootNode.subtreeAngle = Math.PI * 2;
        this.rootNode.angle = 0; // ルートノードは0度から始める
        
        // 子ノード以下の角度範囲を割り当て
        this.assignChildrenAngleRanges(this.rootNode);
    }

    /**
     * 子ノードの角度範囲を親ノードの範囲内で割り当て
     * @param parentNode 親ノード情報
     */
    private assignChildrenAngleRanges(parentNode: NodeInfo): void {
        if (parentNode.children.length === 0) {
            return;
        }
        
        const startAngle = parentNode.startAngle || 0;
        const totalAngle = parentNode.subtreeAngle || Math.PI * 2;
        
        // 親のサブツリーサイズから自身を除いた残りが子孫のサイズ
        const childrenSubtreeSize = (parentNode.subtreeSize || 1) - 1;
        
        let currentAngle = startAngle;
        
        // 子ノードの角度範囲を計算
        parentNode.children.forEach(childNode => {
            // 子ノードのサブツリーが占める角度範囲を計算
            const childAngleRatio = (childNode.subtreeSize || 1) / childrenSubtreeSize;
            const childAngle = totalAngle * childAngleRatio;
            
            // 子ノードの角度範囲を設定
            childNode.startAngle = currentAngle;
            childNode.subtreeAngle = childAngle;
            childNode.endAngle = currentAngle + childAngle;
            
            // 子ノードの角度は範囲の中央
            childNode.angle = currentAngle + (childAngle / 2);
            
            // 次の子ノードの開始角度を更新
            currentAngle += childAngle;
            
            // 再帰的に子ノードの子を処理
            this.assignChildrenAngleRanges(childNode);
        });
    }

    /**
     * ノードを同心円状に配置
     */
    private positionNodesInCircles(): void {
        // 各レベルごとに処理
        this.levelMap.forEach((nodesInLevel, level) => {
            // このレベルの円の半径を計算
            const radius = this.baseRadius + (level * this.radiusIncrement);
            
            // 各ノードを、割り当てられた角度に配置
            nodesInLevel.forEach(nodeInfo => {
                if (nodeInfo.angle !== undefined) {
                    // 極座標から直交座標に変換
                    nodeInfo.x = radius * Math.cos(nodeInfo.angle);
                    nodeInfo.y = radius * Math.sin(nodeInfo.angle);
                }
            });
        });
    }

    /**
     * ノードの位置を更新
     */
    private updateNodePositions(): void {
        this.nodeMap.forEach(nodeInfo => {
            if (nodeInfo.x !== undefined && nodeInfo.y !== undefined) {
                nodeInfo.node.fx = nodeInfo.x;
                nodeInfo.node.fy = nodeInfo.y;
                nodeInfo.node.fz = this.z_layer;
            }
        });
    }

    /**
     * グラフの範囲を計算
     * @returns {minX, maxX, minY, maxY} 範囲
     */
    public getGraphBounds(): {minX: number, maxX: number, minY: number, maxY: number} {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        this.graphData.nodes.forEach(node => {
            minX = Math.min(minX, node.fx || Infinity);
            maxX = Math.max(maxX, node.fx || -Infinity);
            minY = Math.min(minY, node.fy || Infinity);
            maxY = Math.max(maxY, node.fy || -Infinity);
        });
        
        return { minX, maxX, minY, maxY };
    }
}

/**
 * 階層的な円形レイアウトを実行する関数
 * @param graphData グラフデータ
 * @param baseRadius 中心円の半径
 * @param radiusIncrement レベルごとの半径の増分
 * @param z_layer Z軸の層
 * @returns 更新されたグラフデータ
 */
export function executeCircleLayout(
    graphData: GraphData, 
    baseRadius?: number,
    radiusIncrement?: number,
    z_layer: number = -300
): GraphData {
    const layout = new CircleLayout(graphData, baseRadius, radiusIncrement, z_layer);
    return layout.executeLayout();
}

/**
 * カメラ位置を計算する関数
 * @param graphData グラフデータ
 * @param padding パディング
 * @returns カメラ位置情報
 */
export function calculateCameraPosition(
    graphData: GraphData, 
    padding: number = 400
): {
    centerX: number, 
    centerY: number, 
    distance: number
} {
    // グラフの範囲を計算
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    graphData.nodes.forEach(node => {
        minX = Math.min(minX, node.fx || Infinity);
        maxX = Math.max(maxX, node.fx || -Infinity);
        minY = Math.min(minY, node.fy || Infinity);
        maxY = Math.max(maxY, node.fy || -Infinity);
    });
    
    // 中心と距離を計算
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX + padding;
    const height = maxY - minY + padding;
    const distance = Math.max(width, height) * 0.7;
    
    return { centerX, centerY, distance };
}