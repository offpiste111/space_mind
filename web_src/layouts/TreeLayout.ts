// TreeLayout.ts - 様々な方向のツリーレイアウト（right, left, upper, lower）を実装

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

// TreeLayout内部で使用するノード情報拡張インターフェース
interface NodeInfo {
    node: NodeData;
    children: NodeInfo[];
    level: number;
    width: number;
    height: number;
    subtreeHeight: number;
    minY: number;
    maxY: number;
    minX?: number;
    maxX?: number;
    x?: number;
    y?: number;
}

// ツリーレイアウトの方向を表す型
type LayoutDirection = 'right' | 'left' | 'upper' | 'lower';

/**
 * ツリーレイアウトクラス
 * 様々な方向（right, left, upper, lower）のツリーレイアウトを処理
 */
export class TreeLayout {
    private graphData: GraphData;
    private nodeMap: Map<number, NodeInfo> = new Map();
    private rootNode: NodeInfo | null = null;
    private direction: LayoutDirection;
    private z_layer: number;
    private levelSpacing: number = 300; // レベル間の基本間隔

    /**
     * コンストラクタ
     * @param graphData グラフデータ（ノードとリンク）
     * @param direction レイアウト方向 ('right', 'left', 'upper', 'lower')
     * @param z_layer Z軸の層の位置
     */
    constructor(graphData: GraphData, direction: LayoutDirection = 'right', z_layer: number = -300) {
        this.graphData = graphData;
        this.direction = direction;
        this.z_layer = z_layer;
    }

    /**
     * レイアウトを実行し、ノードの位置を更新する
     * @returns 更新されたグラフデータ
     */
    public executeLayout(): GraphData {
        this.initializeNodeMap();
        this.createParentChildRelationships();
        this.findRootNode();
        
        if (!this.rootNode) {
            return this.graphData;
        }
        
        this.assignLevels(this.rootNode, 0);
        this.calculateSubtreeHeight(this.rootNode);
        
        // 垂直位置の割り当てを実行
        let startY = 0;
        this.calculateNodePositions(this.rootNode, startY);
        
        // 水平位置の割り当てを実行
        this.assignHorizontalPositions();
        
        // ノード位置を更新
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
                height: node.size_y || 40,
                subtreeHeight: 0,
                minY: Infinity,
                maxY: -Infinity,
                minX: Infinity,
                maxX: -Infinity
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
            const hasParent = Array.from(this.nodeMap.values()).some(info => 
                info.children.some(child => child.node.id === nodeInfo.node.id)
            );
            
            if (!hasParent) {
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
     * サブツリーの高さを計算
     * @param nodeInfo 処理するノード情報
     * @returns サブツリーの高さ
     */
    private calculateSubtreeHeight(nodeInfo: NodeInfo): number {
        if (nodeInfo.children.length === 0) {
            nodeInfo.subtreeHeight = nodeInfo.height + 40; // 自身の高さ + 余白
            return nodeInfo.subtreeHeight;
        }
        
        // 子ノードのサブツリーの高さを合計
        let totalChildrenHeight = 0;
        nodeInfo.children.forEach(child => {
            totalChildrenHeight += this.calculateSubtreeHeight(child);
        });
        
        // 自身のノード高さと子ノードの合計高さの大きい方を採用
        nodeInfo.subtreeHeight = Math.max(nodeInfo.height + 40, totalChildrenHeight);
        return nodeInfo.subtreeHeight;
    }

    /**
     * 垂直位置を計算
     * @param nodeInfo 処理するノード情報
     * @param startY 開始Y座標
     * @returns 次のノードのY座標
     */
    private calculateNodePositions(nodeInfo: NodeInfo, startY: number): number {
        // 子ノードがない場合は単純に自分の位置を設定
        if (nodeInfo.children.length === 0) {
            nodeInfo.y = startY;
            nodeInfo.minY = nodeInfo.y - nodeInfo.height / 2;
            nodeInfo.maxY = nodeInfo.y + nodeInfo.height / 2;
            return startY + nodeInfo.height + 40; // 次のノードのY座標
        }
        
        // 子ノードがある場合
        if (nodeInfo.children.length === 1) {
            // 子ノードが1つの場合は、同じY座標を設定
            const nextY = this.calculateNodePositions(nodeInfo.children[0], startY);
            const childInfo = nodeInfo.children[0];
            nodeInfo.y = childInfo.y;
            nodeInfo.minY = childInfo.minY;
            nodeInfo.maxY = childInfo.maxY;
            return nextY;
        } else {
            // 子ノードが複数ある場合
            let currentY = startY;
            let minChildY = Infinity;
            let maxChildY = -Infinity;
            
            // まず子ノードの位置を決定
            nodeInfo.children.forEach(child => {
                const nextY = this.calculateNodePositions(child, currentY);
                minChildY = Math.min(minChildY, child.minY);
                maxChildY = Math.max(maxChildY, child.maxY);
                currentY = nextY;
            });
            
            // 親ノードを子ノード範囲の中央に配置
            nodeInfo.y = (minChildY + maxChildY) / 2;
            nodeInfo.minY = minChildY;
            nodeInfo.maxY = maxChildY;
            
            return currentY;
        }
    }

    /**
     * 水平位置を割り当て
     */
    private assignHorizontalPositions(): void {
        // レベルごとにノードをグループ化
        const nodesByLevel = new Map<number, NodeInfo[]>();
        this.nodeMap.forEach(nodeInfo => {
            if (!nodesByLevel.has(nodeInfo.level)) {
                nodesByLevel.set(nodeInfo.level, []);
            }
            nodesByLevel.get(nodeInfo.level)!.push(nodeInfo);
        });

        // レベルに基づいて水平位置を割り当て
        nodesByLevel.forEach((nodesInLevel, level) => {
            nodesInLevel.forEach(nodeInfo => {
                switch (this.direction) {
                    case 'right':
                        nodeInfo.x = level * this.levelSpacing;
                        break;
                    case 'left':
                        nodeInfo.x = -level * this.levelSpacing;
                        break;
                    case 'upper':
                        // upper/lowerの場合はx/y座標を入れ替える
                        nodeInfo.x = nodeInfo.y;
                        nodeInfo.y = -level * this.levelSpacing;
                        break;
                    case 'lower':
                        // upper/lowerの場合はx/y座標を入れ替える
                        nodeInfo.x = nodeInfo.y;
                        nodeInfo.y = level * this.levelSpacing;
                        break;
                }
            });
        });
    }

    /**
     * ノードの位置を更新
     */
    private updateNodePositions(): void {
        this.nodeMap.forEach(nodeInfo => {
            nodeInfo.node.fx = nodeInfo.x;
            nodeInfo.node.fy = nodeInfo.y;
            nodeInfo.node.fz = this.z_layer;
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
 * ツリーレイアウトを実行する関数
 * @param graphData グラフデータ
 * @param direction レイアウト方向
 * @param z_layer Z軸の層
 * @returns 更新されたグラフデータ
 */
export function executeTreeLayout(
    graphData: GraphData, 
    direction: LayoutDirection = 'right', 
    z_layer: number = -300
): GraphData {
    const layout = new TreeLayout(graphData, direction, z_layer);
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