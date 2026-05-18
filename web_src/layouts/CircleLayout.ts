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
    private rootNodes: NodeInfo[] = [];
    private z_layer: number;
    private baseRadius: number = 300;
    private radiusIncrement: number = 300;
    private levelMap: Map<number, NodeInfo[]> = new Map();
    private padding: number = 50; // ノード間の余白
    
    constructor(graphData: GraphData, baseRadius?: number, radiusIncrement?: number, z_layer: number = -300) {
        this.graphData = graphData;
        this.z_layer = z_layer;
        if (baseRadius) this.baseRadius = baseRadius;
        if (radiusIncrement) this.radiusIncrement = radiusIncrement;
    }

    public executeLayout(): GraphData {
        if (this.graphData.nodes.length === 0) {
            return this.graphData;
        }
        
        this.initializeNodeMap();
        this.createParentChildRelationships();
        this.findRootNodes();
        
        if (this.rootNodes.length === 0) {
            return this.graphData;
        }
        
        for (const root of this.rootNodes) {
            this.assignLevelsIterative(root, 0);
            this.calculateSubtreeSizesIterative(root);
        }
        
        this.groupNodesByLevel();
        this.assignRootAngleRanges();
        
        for (const root of this.rootNodes) {
            this.assignChildrenAngleRangesIterative(root);
        }
        
        this.positionNodesInCircles();
        this.updateNodePositions();
        
        return this.graphData;
    }

    private initializeNodeMap(): void {
        this.nodeMap.clear();
        this.graphData.nodes.forEach(node => {
            this.nodeMap.set(node.id, {
                node,
                children: [],
                level: 0,
                width: node.size_x || 200,
                height: node.size_y || 80
            });
        });
    }

    private createParentChildRelationships(): void {
        const nodesWithParents = new Set<number>();
        
        this.graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const sourceInfo = this.nodeMap.get(sourceId);
            const targetInfo = this.nodeMap.get(targetId);
            
            if (sourceInfo && targetInfo) {
                if (!nodesWithParents.has(targetId)) {
                    sourceInfo.children.push(targetInfo);
                    targetInfo.parent = sourceInfo;
                    nodesWithParents.add(targetId);
                }
            }
        });
    }

    private findRootNodes(): void {
        let roots: NodeInfo[] = [];
        this.nodeMap.forEach(nodeInfo => {
            if (!nodeInfo.parent) {
                roots.push(nodeInfo);
            }
        });
        
        if (roots.length === 0 && this.graphData.nodes.length > 0) {
            roots = [this.nodeMap.get(this.graphData.nodes[0].id)!];
        } 
        
        roots.sort((a, b) => b.children.length - a.children.length);
        this.rootNodes = roots;
    }

    private assignLevelsIterative(rootInfo: NodeInfo, startLevel: number): void {
        const queue: { node: NodeInfo, level: number }[] = [{ node: rootInfo, level: startLevel }];
        while (queue.length > 0) {
            const { node, level } = queue.shift()!;
            node.level = level;
            for (const child of node.children) {
                queue.push({ node: child, level: level + 1 });
            }
        }
    }

    private calculateSubtreeSizesIterative(rootInfo: NodeInfo): number {
        const postOrderList: NodeInfo[] = [];
        const stack: NodeInfo[] = [rootInfo];
        const visited = new Set<number>();
        
        while (stack.length > 0) {
            const current = stack[stack.length - 1];
            
            let allChildrenVisited = true;
            for (const child of current.children) {
                if (!visited.has(child.node.id)) {
                    allChildrenVisited = false;
                    stack.push(child);
                    break;
                }
            }
            
            if (allChildrenVisited) {
                stack.pop();
                postOrderList.push(current);
                visited.add(current.node.id);
            }
        }
        
        for (const node of postOrderList) {
            if (node.children.length === 0) {
                node.subtreeSize = 1;
            } else {
                let size = 1;
                for (const child of node.children) {
                    size += child.subtreeSize || 0;
                }
                node.subtreeSize = size;
            }
        }
        
        return rootInfo.subtreeSize || 1;
    }

    private groupNodesByLevel(): void {
        this.levelMap.clear();
        
        this.nodeMap.forEach(nodeInfo => {
            if (!this.levelMap.has(nodeInfo.level)) {
                this.levelMap.set(nodeInfo.level, []);
            }
            this.levelMap.get(nodeInfo.level)!.push(nodeInfo);
        });
    }

    private assignRootAngleRanges(): void {
        let totalSize = 0;
        for (const root of this.rootNodes) {
            totalSize += root.subtreeSize || 1;
        }
        
        let currentAngle = 0;
        
        for (const root of this.rootNodes) {
            const ratio = (root.subtreeSize || 1) / totalSize;
            const rootAngle = Math.PI * 2 * ratio;
            
            root.startAngle = currentAngle;
            root.subtreeAngle = rootAngle;
            root.endAngle = currentAngle + rootAngle;
            root.angle = currentAngle + (rootAngle / 2);
            
            currentAngle += rootAngle;
        }
    }

    private assignChildrenAngleRangesIterative(rootNode: NodeInfo): void {
        const queue: NodeInfo[] = [rootNode];
        
        while (queue.length > 0) {
            const parentNode = queue.shift()!;
            
            if (parentNode.children.length === 0) {
                continue;
            }
        
            const startAngle = parentNode.startAngle || 0;
            const totalAngle = parentNode.subtreeAngle || Math.PI * 2;
            const childCount = parentNode.children.length;
            const angleStep = totalAngle / childCount;
        
            let currentAngle = startAngle;
        
            for (const childNode of parentNode.children) {
                const childAngle = angleStep;
        
                childNode.startAngle = currentAngle;
                childNode.subtreeAngle = childAngle;
                childNode.endAngle = currentAngle + childAngle;
                childNode.angle = currentAngle + (childAngle / 2);
        
                currentAngle += childAngle;
        
                queue.push(childNode);
            }
        }
    }

    private positionNodesInCircles(): void {
        let maxLevel = 0;
        this.levelMap.forEach((_, level) => {
            maxLevel = Math.max(maxLevel, level);
        });

        const radii = new Map<number, number>();
        let currentRadius = this.baseRadius;

        for (let level = 0; level <= maxLevel; level++) {
            let maxDim = 0;
            const nodes = this.levelMap.get(level) || [];
            nodes.forEach(nodeInfo => {
                maxDim = Math.max(maxDim, Math.max(nodeInfo.width, nodeInfo.height));
            });
            
            // 円周上のノードが重ならないための最小半径を計算
            const requiredCircumference = nodes.length * (maxDim + this.padding);
            const minRadius = requiredCircumference / (2 * Math.PI);
            
            currentRadius = Math.max(currentRadius, minRadius);
            radii.set(level, currentRadius);

            // 次のレベルの開始半径を設定 (前のレベルのノードサイズ + 余白)
            currentRadius += maxDim + this.padding;
        }

        this.levelMap.forEach((nodesInLevel, level) => {
            const radius = radii.get(level) || this.baseRadius;

            nodesInLevel.forEach((nodeInfo, index) => {
                if (nodeInfo.angle !== undefined) {
                    const angle = nodeInfo.angle;
                    nodeInfo.x = radius * Math.cos(angle);
                    nodeInfo.y = radius * Math.sin(angle);
                }
            });
        });
    }

    private updateNodePositions(): void {
        this.nodeMap.forEach(nodeInfo => {
            if (nodeInfo.x !== undefined && nodeInfo.y !== undefined) {
                nodeInfo.node.fx = nodeInfo.x;
                nodeInfo.node.fy = nodeInfo.y;
                nodeInfo.node.fz = this.z_layer;
            }
        });
    }

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