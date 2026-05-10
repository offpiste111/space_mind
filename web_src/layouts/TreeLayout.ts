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
    private rootNodes: NodeInfo[] = [];
    private direction: LayoutDirection;
    private z_layer: number;
    private levelSpacing: number = 300;
    private paddingY: number = 200; // Increased padding for Y spacing
    private paddingX: number = 300; // Increased padding for X spacing

    constructor(graphData: GraphData, direction: LayoutDirection = 'right', z_layer: number = -300) {
        this.graphData = graphData;
        this.direction = direction;
        this.z_layer = z_layer;
    }

    public executeLayout(): GraphData {
        this.initializeNodeMap();
        this.createParentChildRelationships();
        this.findRootNodes();
        
        if (this.rootNodes.length === 0) {
            return this.graphData;
        }
        
        let startY = 0;
        
        for (const root of this.rootNodes) {
            this.assignLevelsIterative(root, 0);
            this.calculateSubtreeHeightIterative(root);
            startY = this.calculateNodePositionsIterative(root, startY);
            startY += this.paddingY * 2; // 独立したツリー間に余白をさらに追加
        }
        
        this.assignHorizontalPositions();
        this.updateNodePositions();
        
        return this.graphData;
    }

    private getNodeThickness(nodeInfo: NodeInfo): number {
        return (this.direction === 'upper' || this.direction === 'lower') ? nodeInfo.width : nodeInfo.height;
    }

    private getNodeLength(nodeInfo: NodeInfo): number {
        return (this.direction === 'upper' || this.direction === 'lower') ? nodeInfo.height : nodeInfo.width;
    }

    private initializeNodeMap(): void {
        this.nodeMap.clear();
        this.graphData.nodes.forEach(node => {
            this.nodeMap.set(node.id, {
                node,
                children: [],
                level: 0,
                width: node.size_x || 200,
                height: node.size_y || 80,
                subtreeHeight: 0,
                minY: Infinity,
                maxY: -Infinity,
                minX: Infinity,
                maxX: -Infinity
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
                    nodesWithParents.add(targetId);
                }
            }
        });
    }

    private findRootNodes(): void {
        let roots: NodeInfo[] = [];
        
        const hasParentSet = new Set<number>();
        this.nodeMap.forEach(info => {
            info.children.forEach(child => hasParentSet.add(child.node.id));
        });
        
        this.nodeMap.forEach(info => {
            if (!hasParentSet.has(info.node.id)) {
                roots.push(info);
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

    private calculateSubtreeHeightIterative(rootInfo: NodeInfo): number {
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
            const thickness = this.getNodeThickness(node);
            if (node.children.length === 0) {
                node.subtreeHeight = thickness + this.paddingY;
            } else {
                let totalChildrenHeight = 0;
                for (const child of node.children) {
                    totalChildrenHeight += child.subtreeHeight;
                }
                node.subtreeHeight = Math.max(thickness + this.paddingY, totalChildrenHeight);
            }
        }
        
        return rootInfo.subtreeHeight;
    }

    private calculateNodePositionsIterative(rootInfo: NodeInfo, initialStartY: number): number {
        const stack: {
            node: NodeInfo;
            startY: number;
            childIndex: number;
            currentY: number;
            minChildY: number;
            maxChildY: number;
        }[] = [{
            node: rootInfo,
            startY: initialStartY,
            childIndex: 0,
            currentY: initialStartY,
            minChildY: Infinity,
            maxChildY: -Infinity
        }];

        let finalNextY = initialStartY;

        while (stack.length > 0) {
            const frame = stack[stack.length - 1];
            const nodeInfo = frame.node;
            const thickness = this.getNodeThickness(nodeInfo);

            if (nodeInfo.children.length === 0) {
                nodeInfo.y = frame.startY;
                nodeInfo.minY = nodeInfo.y - thickness / 2;
                nodeInfo.maxY = nodeInfo.y + thickness / 2;
                
                const nextY = frame.startY + thickness + this.paddingY;
                
                stack.pop();
                
                if (stack.length > 0) {
                    const parentFrame = stack[stack.length - 1];
                    parentFrame.currentY = nextY;
                    parentFrame.minChildY = Math.min(parentFrame.minChildY, nodeInfo.minY);
                    parentFrame.maxChildY = Math.max(parentFrame.maxChildY, nodeInfo.maxY);
                } else {
                    finalNextY = nextY;
                }
            } else {
                if (frame.childIndex < nodeInfo.children.length) {
                    const child = nodeInfo.children[frame.childIndex];
                    frame.childIndex++;
                    
                    stack.push({
                        node: child,
                        startY: frame.currentY,
                        childIndex: 0,
                        currentY: frame.currentY,
                        minChildY: Infinity,
                        maxChildY: -Infinity
                    });
                } else {
                    if (nodeInfo.children.length === 1) {
                        const childInfo = nodeInfo.children[0];
                        nodeInfo.y = childInfo.y;
                        nodeInfo.minY = childInfo.minY;
                        nodeInfo.maxY = childInfo.maxY;
                    } else {
                        nodeInfo.y = (frame.minChildY + frame.maxChildY) / 2;
                        nodeInfo.minY = frame.minChildY;
                        nodeInfo.maxY = frame.maxChildY;
                    }
                    
                    const nextY = frame.currentY;
                    
                    stack.pop();
                    
                    if (stack.length > 0) {
                        const parentFrame = stack[stack.length - 1];
                        parentFrame.currentY = nextY;
                        parentFrame.minChildY = Math.min(parentFrame.minChildY, nodeInfo.minY);
                        parentFrame.maxChildY = Math.max(parentFrame.maxChildY, nodeInfo.maxY);
                    } else {
                        finalNextY = nextY;
                    }
                }
            }
        }
        return finalNextY;
    }

    private assignHorizontalPositions(): void {
        const nodesByLevel = new Map<number, NodeInfo[]>();
        let maxLevel = 0;
        this.nodeMap.forEach(nodeInfo => {
            if (!nodesByLevel.has(nodeInfo.level)) {
                nodesByLevel.set(nodeInfo.level, []);
            }
            nodesByLevel.get(nodeInfo.level)!.push(nodeInfo);
            maxLevel = Math.max(maxLevel, nodeInfo.level);
        });

        const levelOffsets = new Map<number, number>();
        let currentOffset = 0;
        
        for (let level = 0; level <= maxLevel; level++) {
            levelOffsets.set(level, currentOffset);
            
            let maxLength = 0;
            const nodes = nodesByLevel.get(level) || [];
            nodes.forEach(nodeInfo => {
                maxLength = Math.max(maxLength, this.getNodeLength(nodeInfo));
            });
            
            // 各レベル間の間隔は、そのレベルでのノードの最大長さ + paddingX
            currentOffset += maxLength + this.paddingX;
        }

        nodesByLevel.forEach((nodesInLevel, level) => {
            nodesInLevel.forEach(nodeInfo => {
                const offset = levelOffsets.get(level) || 0;
                switch (this.direction) {
                    case 'right':
                        nodeInfo.x = offset;
                        break;
                    case 'left':
                        nodeInfo.x = -offset;
                        break;
                    case 'upper':
                        nodeInfo.x = nodeInfo.y;
                        nodeInfo.y = -offset;
                        break;
                    case 'lower':
                        nodeInfo.x = nodeInfo.y;
                        nodeInfo.y = offset;
                        break;
                }
            });
        });
    }

    private updateNodePositions(): void {
        this.nodeMap.forEach(nodeInfo => {
            nodeInfo.node.fx = nodeInfo.x;
            nodeInfo.node.fy = nodeInfo.y;
            nodeInfo.node.fz = this.z_layer;
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