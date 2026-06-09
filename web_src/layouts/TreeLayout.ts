// TreeLayout.ts - グループ対応・ノードサイズ適応型ツリーレイアウト（right, left, upper, lower）

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
    subtreeThickness: number; // サブツリー全体の厚み（配置方向に応じた）
    leafCount: number;        // サブツリー内のリーフノード数（角度配分の基準）
    minY: number;
    maxY: number;
    minX?: number;
    maxX?: number;
    x?: number;
    y?: number;
    groupId: number;          // ノードのグループID
}

// ツリーレイアウトの方向を表す型
type LayoutDirection = 'right' | 'left' | 'upper' | 'lower';

/**
 * 改良版ツリーレイアウトクラス
 * - グループ別にルートノードをクラスタリングして隣接配置
 * - ノードの実サイズに基づくレベル間隔の適応的計算
 * - リーフノード数に基づくサブツリーの空間配分でバランス改善
 * - 不均衡なツリーでも美しく配置
 */
export class TreeLayout {
    private graphData: GraphData;
    private nodeMap: Map<number, NodeInfo> = new Map();
    private rootNodes: NodeInfo[] = [];
    private direction: LayoutDirection;
    private z_layer: number;
    private selectedNodeIds: Set<number>;
    private customRootNodeId?: number;
    private cameraPosition?: { x: number, y: number, z: number };
    private cameraRight?: { x: number, y: number, z: number };
    private cameraUp?: { x: number, y: number, z: number };
    // パディング値（ノードサイズに応じて動的に調整される基準値）
    private basePaddingThickness: number = 40;  // ノードの厚み方向（配置直交方向）の最小余白
    private basePaddingLength: number = 80;     // ノードの長さ方向（配置進行方向）の最小余白

    constructor(
        graphData: GraphData, 
        direction: LayoutDirection = 'right', 
        z_layer: number = -300, 
        selectedNodeIds: number[] = [],
        customRootNodeId?: number,
        cameraPosition?: { x: number, y: number, z: number },
        cameraRight?: { x: number, y: number, z: number },
        cameraUp?: { x: number, y: number, z: number }
    ) {
        this.graphData = graphData;
        this.direction = direction;
        this.z_layer = z_layer;
        this.selectedNodeIds = new Set(selectedNodeIds);
        this.customRootNodeId = customRootNodeId;
        this.cameraPosition = cameraPosition;
        this.cameraRight = cameraRight;
        this.cameraUp = cameraUp;
    }

    public executeLayout(): GraphData {
        this.initializeNodeMap();
        this.createParentChildRelationships();
        
        // 各親子リンク（friend以外）の出現順（links配列におけるインデックス）を記録
        const linkOrderMap = new Map<string, number>();
        this.graphData.links.forEach((link, idx) => {
            if (link.type === 'friend') {
                return;
            }
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            const key = `${sourceId}-${targetId}`;
            if (!linkOrderMap.has(key)) {
                linkOrderMap.set(key, idx);
            }
        });

        // 各ノードの子ノードリスト（children）を、リンクの作成順（linksの定義順）の降順でソートする
        // 座標計算が+y方向（インデックスが大きいほど上/右）に行われるため、定義順が早いものほど配列の末尾（インデックス大）にする
        this.nodeMap.forEach((info) => {
            const parentId = info.node.id;
            info.children.sort((a, b) => {
                const keyA = `${parentId}-${a.node.id}`;
                const keyB = `${parentId}-${b.node.id}`;
                const idxA = linkOrderMap.has(keyA) ? linkOrderMap.get(keyA)! : 999999;
                const idxB = linkOrderMap.has(keyB) ? linkOrderMap.get(keyB)! : 999999;
                return idxB - idxA; // 降順
            });
        });

        this.findRootNodes();
        
        if (this.rootNodes.length === 0) {
            return this.graphData;
        }
        
        // 始祖ノードを並べ替える
        // 1. 選択されている始祖ノードを優先
        // 2. その中でIDが古い順（ID昇順）
        // 3. 選択されていない始祖ノードを後回し
        // 4. その中でIDが古い順（ID昇順）
        const sortedRoots = [...this.rootNodes].sort((a, b) => {
            const aSelected = this.selectedNodeIds.has(a.node.id);
            const bSelected = this.selectedNodeIds.has(b.node.id);
            
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            
            return a.node.id - b.node.id;
        });
        
        let currentOffset = 0;
        const rootPadding = 200; // 独立したツリー間の進行方向の最小余白
        
        for (const root of sortedRoots) {
            this.assignLevelsIterative(root, 0);
            this.calculateLeafCountIterative(root);
            this.calculateSubtreeThicknessIterative(root);
            
            // 直交方向の位置：常に0を基準にして各ツリーの中心を揃える
            this.calculateNodePositionsIterative(root, 0);
            
            // このツリーの進行方向の位置（オフセット）を累積値 currentOffset から再帰的に割り当て
            this.assignOffsetRecursive(root, currentOffset);
            
            // このツリー全体の最も下流の最大オフセット位置を計算
            const maxTreeOffset = this.getMaxOffset(root);
            
            // 次のツリーの開始位置を更新
            currentOffset = maxTreeOffset + rootPadding;
        }
        
        this.assignHorizontalPositions();
        this.updateNodePositions();
        
        return this.graphData;
    }

    /** ノードの「厚み」（配置方向に直交する寸法） */
    private getNodeThickness(nodeInfo: NodeInfo): number {
        return (this.direction === 'upper' || this.direction === 'lower') ? nodeInfo.width : nodeInfo.height;
    }

    /** ノードの「長さ」（配置方向に沿った寸法） */
    private getNodeLength(nodeInfo: NodeInfo): number {
        return (this.direction === 'upper' || this.direction === 'lower') ? nodeInfo.height : nodeInfo.width;
    }

    /** ノードマップを初期化 */
    private initializeNodeMap(): void {
        this.nodeMap.clear();
        this.graphData.nodes.forEach(node => {
            let defaultWidth = 200;
            let defaultHeight = 120;
            
            if (node.type === "issue") {
                defaultWidth = 300;
                defaultHeight = 200;
            } else if (node.type === "task") {
                defaultWidth = 250;
                defaultHeight = 150;
            } else if (node.type && node.type !== "normal" && node.type !== "3dobject") {
                defaultWidth = 250;
                defaultHeight = 100;
            } else if (node.type === "3dobject") {
                defaultWidth = 120;
                defaultHeight = 120;
            }

            const width = node.size_x || defaultWidth;
            const height = node.size_y || defaultHeight;

            this.nodeMap.set(node.id, {
                node,
                children: [],
                level: 0,
                width: width,
                height: height,
                subtreeThickness: 0,
                leafCount: 0,
                minY: Infinity,
                maxY: -Infinity,
                minX: Infinity,
                maxX: -Infinity,
                groupId: node.group || 0
            });
        });
    }

    /** 親子関係を構築（友達リンクは除外、選択された始祖ノードを優先） */
    private createParentChildRelationships(): void {
        const nodesWithParents = new Set<number>();
        
        // リンクマップを構築して、親から子へのリンクを高速にたどれるようにする
        const adjMap = new Map<number, { targetId: number; linkIdx: number }[]>();
        
        this.graphData.links.forEach((link, idx) => {
            if (link.type === 'friend') {
                return;
            }
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            if (!adjMap.has(sourceId)) {
                adjMap.set(sourceId, []);
            }
            adjMap.get(sourceId)!.push({ targetId, linkIdx: idx });
        });

        // 親を持たないノード（始祖ノード）を検出する
        const targetsOfParentChildLinks = new Set<number>();
        this.graphData.links.forEach(link => {
            if (link.type === 'friend') return;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            targetsOfParentChildLinks.add(targetId);
        });

        const rootIds: number[] = [];
        this.graphData.nodes.forEach(node => {
            if (!targetsOfParentChildLinks.has(node.id)) {
                rootIds.push(node.id);
            }
        });

        // 始祖ノードを選択されたものとされていないものに分け、それぞれID昇順（古い順）にソートする
        const selectedRoots: number[] = [];
        const unselectedRoots: number[] = [];
        rootIds.forEach(id => {
            if (this.selectedNodeIds.has(id)) {
                selectedRoots.push(id);
            } else {
                unselectedRoots.push(id);
            }
        });
        selectedRoots.sort((a, b) => a - b);
        unselectedRoots.sort((a, b) => a - b);

        // BFSで親子構造を構築する処理
        const traverse = (startRoots: number[]) => {
            const queue = [...startRoots];
            while (queue.length > 0) {
                const parentId = queue.shift()!;
                const parentInfo = this.nodeMap.get(parentId);
                if (!parentInfo) continue;

                // 子ノードへのリンクを取得し、元々のlinksでの定義順を保つためにソート
                const childrenLinks = adjMap.get(parentId) || [];
                childrenLinks.sort((a, b) => a.linkIdx - b.linkIdx);

                childrenLinks.forEach(({ targetId }) => {
                    if (!nodesWithParents.has(targetId)) {
                        const childInfo = this.nodeMap.get(targetId);
                        if (childInfo) {
                            parentInfo.children.push(childInfo);
                            nodesWithParents.add(targetId);
                            queue.push(targetId);
                        }
                    }
                });
            }
        };

        // 1回目の探索：選択された始祖ノードから1つずつ、IDの古い順に個別にツリーを構築
        selectedRoots.forEach(rootId => {
            traverse([rootId]);
        });

        // 2回目の探索：選択されていない始祖ノードから1つずつ、IDの古い順に個別にツリーを構築
        unselectedRoots.forEach(rootId => {
            traverse([rootId]);
        });
        
        // 孤立した循環などの例外ノードも処理
        const remainingRoots: number[] = [];
        this.graphData.nodes.forEach(node => {
            if (!nodesWithParents.has(node.id) && !selectedRoots.includes(node.id) && !unselectedRoots.includes(node.id)) {
                let hasParentInMap = false;
                this.nodeMap.forEach(info => {
                    if (info.children.some(c => c.node.id === node.id)) {
                        hasParentInMap = true;
                    }
                });
                if (!hasParentInMap) {
                    remainingRoots.push(node.id);
                }
            }
        });
        
        if (remainingRoots.length > 0) {
            traverse(remainingRoots);
        }
    }

    /** ルートノードを検出 */
    private findRootNodes(): void {
        if (this.customRootNodeId !== undefined) {
            const customRoot = this.nodeMap.get(this.customRootNodeId);
            if (customRoot) {
                this.rootNodes = [customRoot];
                return;
            }
        }

        let roots: NodeInfo[] = [];
        
        // 親を持たないノードをルートとする
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
        
        // サブツリーサイズの大きいものを優先（安定したソート）
        roots.sort((a, b) => {
            const sizeA = this.countDescendants(a);
            const sizeB = this.countDescendants(b);
            return sizeB - sizeA;
        });
        this.rootNodes = roots;
    }

    /** ノードの子孫数を再帰的にカウント */
    private countDescendants(nodeInfo: NodeInfo): number {
        let count = 1;
        for (const child of nodeInfo.children) {
            count += this.countDescendants(child);
        }
        return count;
    }

    /** 
     * ルートノードをグループでクラスタリング
     * 同じグループのルートを隣接させ、グループ内ではサブツリーサイズで降順ソート
     */
    private clusterRootsByGroup(): NodeInfo[] {
        // グループごとにルートノードを分類
        const groupMap = new Map<number, NodeInfo[]>();
        for (const root of this.rootNodes) {
            const gid = root.groupId;
            if (!groupMap.has(gid)) {
                groupMap.set(gid, []);
            }
            groupMap.get(gid)!.push(root);
        }

        // グループを総サブツリーサイズの降順でソート（最大のグループを先頭に）
        const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => {
            const totalA = a[1].reduce((sum, r) => sum + this.countDescendants(r), 0);
            const totalB = b[1].reduce((sum, r) => sum + this.countDescendants(r), 0);
            return totalB - totalA;
        });

        // グループ順にルートノードを連結
        const result: NodeInfo[] = [];
        for (const [, roots] of sortedGroups) {
            // グループ内はサブツリーサイズ降順
            roots.sort((a, b) => this.countDescendants(b) - this.countDescendants(a));
            result.push(...roots);
        }
        return result;
    }

    /** レベル（深さ）を反復的に割り当て */
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

    /** リーフノード数を後順走査で計算（空間配分の基準） */
    private calculateLeafCountIterative(rootInfo: NodeInfo): void {
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
                // リーフノード：自分自身を1とカウント
                node.leafCount = 1;
            } else {
                // 内部ノード：子のリーフ数を合算
                node.leafCount = node.children.reduce((sum, child) => sum + child.leafCount, 0);
            }
        }
    }

    /** 
     * サブツリーの厚み（配置方向に直交する方向のサイズ）を後順走査で計算
     * リーフノードの実サイズに基づく適応的計算
     */
    private calculateSubtreeThicknessIterative(rootInfo: NodeInfo): number {
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
                // リーフノード：自身の厚み＋パディング
                node.subtreeThickness = thickness + this.basePaddingThickness;
            } else {
                // 内部ノード：子サブツリーの厚みの合計と自身の厚みの大きい方
                let totalChildrenThickness = 0;
                for (const child of node.children) {
                    totalChildrenThickness += child.subtreeThickness;
                }
                node.subtreeThickness = Math.max(thickness + this.basePaddingThickness, totalChildrenThickness);
            }
        }
        
        return rootInfo.subtreeThickness;
    }

    /** 
     * ノード位置を反復的に計算
     * サブツリーの厚みに基づく空間配分で、不均衡なツリーでもバランスよく配置
     */
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
                // リーフノード：割り当てられた開始位置に配置
                nodeInfo.y = frame.startY + thickness / 2;
                nodeInfo.minY = nodeInfo.y - thickness / 2;
                nodeInfo.maxY = nodeInfo.y + thickness / 2;
                
                const nextY = frame.startY + thickness + this.basePaddingThickness;
                
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
                    // 次の子ノードを処理
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
                    // 全ての子ノードの処理が完了 → 親ノードの位置を子の中心に配置
                    if (nodeInfo.children.length === 1) {
                        const childInfo = nodeInfo.children[0];
                        nodeInfo.y = childInfo.y;
                        nodeInfo.minY = childInfo.minY;
                        nodeInfo.maxY = childInfo.maxY;
                    } else {
                        // 子ノードの最初と最後の中心に親を配置（重心方式）
                        const firstChild = nodeInfo.children[0];
                        const lastChild = nodeInfo.children[nodeInfo.children.length - 1];
                        nodeInfo.y = ((firstChild.y || 0) + (lastChild.y || 0)) / 2;
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

    /** 
     * 水平位置（レベル方向）を割り当て
     * 各レベルのノード最大長さに基づいて適応的にレベル間隔を計算
     */
    /** 
     * 水平位置（レベル方向）を割り当て
     * 各系列ごとに親子パスに沿ってオフセットを累積計算し、他系列のサイズ影響を排除
     */
    /**
     * 指定されたルートノードのツリー内で最も下流にあるノードの最大オフセット位置を取得する
     */
    private getMaxOffset(nodeInfo: NodeInfo): number {
        let maxVal = (nodeInfo as any).calculatedOffset + this.getNodeLength(nodeInfo) / 2;
        
        for (const child of nodeInfo.children) {
            const childMax = this.getMaxOffset(child);
            if (childMax > maxVal) {
                maxVal = childMax;
            }
        }
        return maxVal;
    }

    private assignHorizontalPositions(): void {
        // 各ノードに水平位置を割り当て（方向に応じて座標変換）
        this.nodeMap.forEach(nodeInfo => {
            const offset = (nodeInfo as any).calculatedOffset || 0;
            switch (this.direction) {
                case 'right':
                    nodeInfo.x = offset;
                    break;
                case 'left':
                    nodeInfo.x = -offset;
                    break;
                case 'upper':
                    // 上方向：yを水平位置として使っていたものをx座標にスワップ
                    nodeInfo.x = nodeInfo.y;
                    nodeInfo.y = -offset;
                    break;
                case 'lower':
                    nodeInfo.x = nodeInfo.y;
                    nodeInfo.y = offset;
                    break;
            }
        });
    }

    /**
     * 親子パスに沿ってオフセットを再帰的に計算
     */
    private assignOffsetRecursive(nodeInfo: NodeInfo, currentOffset: number): void {
        (nodeInfo as any).calculatedOffset = currentOffset;

        const parentLength = this.getNodeLength(nodeInfo);

        for (const child of nodeInfo.children) {
            const childLength = this.getNodeLength(child);
            // 適応パディング：親子それぞれの長さのうち大きい方をベースに計算
            const adaptivePadding = Math.max(this.basePaddingLength, Math.max(parentLength, childLength) * 0.12);
            const childOffset = currentOffset + parentLength / 2 + adaptivePadding + childLength / 2;
            
            this.assignOffsetRecursive(child, childOffset);
        }
    }

    /** ノードの最終位置をGraphDataに反映 */
    private updateNodePositions(): void {
        if (this.customRootNodeId !== undefined) {
            const nodesToUpdate = new Set<number>();
            const collectNodes = (nodeInfo: NodeInfo) => {
                if (!nodeInfo) return;
                nodesToUpdate.add(nodeInfo.node.id);
                nodeInfo.children.forEach(collectNodes);
            };
            
            const customRoot = this.nodeMap.get(this.customRootNodeId);
            if (customRoot) {
                collectNodes(customRoot);
                
                // 1. ルートノードの「現在の元の位置」を取得
                let origX = customRoot.node.fx !== undefined ? customRoot.node.fx : (customRoot.node.x || 0);
                let origY = customRoot.node.fy !== undefined ? customRoot.node.fy : (customRoot.node.y || 0);
                const origZ = customRoot.node.fz !== undefined ? customRoot.node.fz : (customRoot.node.z !== undefined ? customRoot.node.z : this.z_layer);
                
                // カメラ位置が指定されている場合、画面上の見かけの位置を維持したまま、Z座標をthis.z_layerに投影する
                if (this.cameraPosition && Math.abs(origZ - this.z_layer) > 0.1) {
                    const cam = this.cameraPosition;
                    // 分母がゼロになるのを防ぐ
                    const denom = origZ - cam.z;
                    if (Math.abs(denom) > 0.1) {
                        const t = (this.z_layer - cam.z) / denom;
                        origX = cam.x + t * (origX - cam.x);
                        origY = cam.y + t * (origY - cam.y);
                    }
                }

                // 2. 計算されたルート位置との相対位置を元に各ノードを配置
                this.nodeMap.forEach(nodeInfo => {
                    if (nodesToUpdate.has(nodeInfo.node.id)) {
                        if (nodeInfo.node.id === this.customRootNodeId) {
                            // ルートノード自身の位置は変更しない（補正後のfx, fyを維持、Z座標は投影後のthis.z_layer）
                            nodeInfo.node.fx = origX;
                            nodeInfo.node.fy = origY;
                            nodeInfo.node.fz = this.z_layer;
                        } else {
                            // ルートノードからの相対レイアウト座標
                            const rx = (nodeInfo.x || 0) - (customRoot.x || 0);
                            const ry = (nodeInfo.y || 0) - (customRoot.y || 0);

                            if (this.cameraRight && this.cameraUp) {
                                // カメラのローカル軸（画面に平行な面）に合わせて、3D空間での相対変位を計算
                                const dx_3d = rx * this.cameraRight.x + ry * this.cameraUp.x;
                                const dy_3d = rx * this.cameraRight.y + ry * this.cameraUp.y;
                                const dz_3d = rx * this.cameraRight.z + ry * this.cameraUp.z;

                                nodeInfo.node.fx = origX + dx_3d;
                                nodeInfo.node.fy = origY + dy_3d;
                                nodeInfo.node.fz = this.z_layer + dz_3d;
                            } else {
                                // フォールバック: ワールド座標系のXY平面上での平行移動
                                nodeInfo.node.fx = origX + rx;
                                nodeInfo.node.fy = origY + ry;
                                nodeInfo.node.fz = this.z_layer;
                            }
                        }
                    }
                });
            }
        } else {
            this.nodeMap.forEach(nodeInfo => {
                nodeInfo.node.fx = nodeInfo.x;
                nodeInfo.node.fy = nodeInfo.y;
                nodeInfo.node.fz = this.z_layer;
            });
        }
    }

    /** グラフの境界を取得 */
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
    z_layer: number = -300,
    selectedNodeIds: number[] = [],
    customRootNodeId?: number,
    cameraPosition?: { x: number, y: number, z: number },
    cameraRight?: { x: number, y: number, z: number },
    cameraUp?: { x: number, y: number, z: number }
): GraphData {
    const layout = new TreeLayout(graphData, direction, z_layer, selectedNodeIds, customRootNodeId, cameraPosition, cameraRight, cameraUp);
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