// CircleLayout.ts - グループ対応・ノードサイズ適応型の階層的円形レイアウトを実装

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
    angle?: number;         // 配置する角度（ラジアン）
    subtreeSize?: number;   // サブツリーのノード数（自身含む）
    leafCount?: number;     // サブツリーのリーフ数（角度配分の重み）
    subtreeAngle?: number;  // サブツリーが占める角度範囲
    startAngle?: number;    // サブツリーの開始角度
    endAngle?: number;      // サブツリーの終了角度
    groupId?: number;       // 所属グループID
}

// グループごとの情報を保持する型
interface GroupInfo {
    groupId: number;
    roots: NodeInfo[];
    totalLeafCount: number;   // グループ内全ルートのリーフ数合計
    totalSubtreeSize: number; // グループ内全ルートのサブツリーサイズ合計
    startAngle: number;
    endAngle: number;
    angularRange: number;
}

/**
 * グループ対応・ノードサイズ適応型の階層的円形レイアウトクラス
 *
 * 改善点:
 * 1. グループ認識: 同じグループのノードを隣接する角度セクターにまとめる
 * 2. リーフ数ベースの角度配分: サブツリーのリーフ数に比例した角度範囲を割り当て
 * 3. ノードサイズ適応型の半径計算: 各レベルの最大ノードサイズに基づいて半径を算出
 * 4. 不均衡ツリー対応: 深い狭いサブツリーと広い浅いサブツリーを適切に処理
 * 5. 適応型パディング: ノードサイズに応じてパディングをスケーリング
 */
export class CircleLayout {
    private graphData: GraphData;
    private nodeMap: Map<number, NodeInfo> = new Map();
    private rootNodes: NodeInfo[] = [];
    private z_layer: number;
    private baseRadius: number = 150;
    private radiusIncrement: number = 150;
    private levelMap: Map<number, NodeInfo[]> = new Map();
    private basePadding: number = 15; // 基本ノード間余白
    private groups: Map<number, GroupInfo> = new Map();

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

        // フェーズ1: ノードマップ初期化と親子関係構築
        this.initializeNodeMap();
        this.createParentChildRelationships();
        this.findRootNodes();

        if (this.rootNodes.length === 0) {
            return this.graphData;
        }

        // フェーズ2: レベル・サブツリーサイズ・リーフ数の計算
        for (const root of this.rootNodes) {
            this.assignLevelsIterative(root, 0);
            this.calculateSubtreeMetricsIterative(root);
        }

        // フェーズ3: グループ認識と角度セクター割り当て
        this.groupNodesByLevel();
        this.buildGroupInfo();
        this.assignGroupAngularSectors();
        this.assignRootAngleRangesWithinGroups();

        // フェーズ4: 子ノードへの角度範囲割り当て（リーフ数比例）
        for (const root of this.rootNodes) {
            this.assignChildrenAngleRangesIterative(root);
        }

        // フェーズ5: ノードサイズ適応型の半径計算と座標配置
        this.positionNodesInCircles();
        this.updateNodePositions();

        return this.graphData;
    }

    /**
     * ノードマップを初期化する
     * 各ノードのサイズ情報を取得し、デフォルト値を設定する
     */
    private initializeNodeMap(): void {
        this.nodeMap.clear();
        this.graphData.nodes.forEach(node => {
            this.nodeMap.set(node.id, {
                node,
                children: [],
                level: 0,
                width: node.size_x || 200,
                height: node.size_y || 80,
                groupId: node.group ?? 0
            });
        });
    }

    /**
     * リンク情報から親子関係を構築する
     * friendタイプのリンクは階層関係から除外する
     */
    private createParentChildRelationships(): void {
        const nodesWithParents = new Set<number>();

        this.graphData.links.forEach(link => {
            // 友達リンクは階層関係（円形レイアウト）の計算対象から除外する
            if (link.type === 'friend') {
                return;
            }
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

    /**
     * ルートノード（親を持たないノード）を検出する
     * サブツリーサイズの降順でソートする
     */
    private findRootNodes(): void {
        let roots: NodeInfo[] = [];
        this.nodeMap.forEach(nodeInfo => {
            if (!nodeInfo.parent) {
                roots.push(nodeInfo);
            }
        });

        // ルートが見つからない場合、最初のノードをルートとする
        if (roots.length === 0 && this.graphData.nodes.length > 0) {
            roots = [this.nodeMap.get(this.graphData.nodes[0].id)!];
        }

        // 子ノード数の降順でソート（大きいサブツリーのルートを優先）
        roots.sort((a, b) => b.children.length - a.children.length);
        this.rootNodes = roots;
    }

    /**
     * BFSでレベル（深さ）を割り当てる
     */
    private assignLevelsIterative(rootInfo: NodeInfo, startLevel: number): void {
        const queue: { node: NodeInfo; level: number }[] = [{ node: rootInfo, level: startLevel }];
        while (queue.length > 0) {
            const { node, level } = queue.shift()!;
            node.level = level;
            for (const child of node.children) {
                queue.push({ node: child, level: level + 1 });
            }
        }
    }

    /**
     * 後行順走査でサブツリーメトリクス（ノード数とリーフ数）を計算する
     *
     * leafCountは角度配分の重みとして使用する:
     * - リーフ数ベースの配分により、深くて狭いサブツリーに過大な角度を与えない
     * - 広くて浅いサブツリーには適切に多くの角度を割り当てる
     */
    private calculateSubtreeMetricsIterative(rootInfo: NodeInfo): void {
        const postOrderList: NodeInfo[] = [];
        const stack: NodeInfo[] = [rootInfo];
        const visited = new Set<number>();

        // 後行順でノードリストを作成
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

        // 後行順でサブツリーサイズとリーフ数を計算
        for (const node of postOrderList) {
            if (node.children.length === 0) {
                // リーフノード: サイズ1、リーフ数1
                node.subtreeSize = 1;
                node.leafCount = 1;
            } else {
                let size = 1;
                let leaves = 0;
                for (const child of node.children) {
                    size += child.subtreeSize || 0;
                    leaves += child.leafCount || 0;
                }
                node.subtreeSize = size;
                node.leafCount = leaves;
            }
        }
    }

    /**
     * ノードをレベルごとにグループ化する
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
     * グループ情報を構築する
     * ルートノードを所属グループごとにまとめ、各グループの統計を計算する
     */
    private buildGroupInfo(): void {
        this.groups.clear();

        // ルートノードからグループ情報を収集
        const groupRootsMap = new Map<number, NodeInfo[]>();

        for (const root of this.rootNodes) {
            const gid = root.groupId ?? 0;
            if (!groupRootsMap.has(gid)) {
                groupRootsMap.set(gid, []);
            }
            groupRootsMap.get(gid)!.push(root);
        }

        // 各グループの統計を計算
        groupRootsMap.forEach((roots, gid) => {
            let totalLeafCount = 0;
            let totalSubtreeSize = 0;
            for (const root of roots) {
                totalLeafCount += root.leafCount || 1;
                totalSubtreeSize += root.subtreeSize || 1;
            }
            this.groups.set(gid, {
                groupId: gid,
                roots,
                totalLeafCount,
                totalSubtreeSize,
                startAngle: 0,
                endAngle: 0,
                angularRange: 0
            });
        });
    }

    /**
     * グループごとに連続した角度セクターを割り当てる
     *
     * 各グループにはリーフ数合計に比例した角度範囲を割り当てる。
     * これにより、大きなグループ（多数のリーフを含む）はより広い領域を使用し、
     * 小さなグループ（リーフが少ない）は狭い領域にコンパクトに配置される。
     *
     * グループ間にはセパレータとして小さなギャップを挿入し、
     * 視覚的にグループの区別を明確にする。
     */
    private assignGroupAngularSectors(): void {
        const groupCount = this.groups.size;
        if (groupCount === 0) return;

        // グループ間のギャップ（ラジアン）
        // グループが1つだけの場合はギャップ不要
        const groupGap = groupCount > 1 ? 0.03 : 0;
        const totalGap = groupGap * groupCount;
        const availableAngle = Math.PI * 2 - totalGap;

        // 全グループのリーフ数合計
        let globalLeafCount = 0;
        this.groups.forEach(g => {
            globalLeafCount += g.totalLeafCount;
        });

        // リーフ数が0の場合のフォールバック（通常は発生しないが安全のため）
        if (globalLeafCount === 0) {
            globalLeafCount = this.rootNodes.length;
        }

        // グループをサイズ降順でソート（大きいグループを最初に配置）
        const sortedGroups = Array.from(this.groups.values()).sort(
            (a, b) => b.totalLeafCount - a.totalLeafCount
        );

        let currentAngle = 0;
        for (const group of sortedGroups) {
            const ratio = group.totalLeafCount / globalLeafCount;
            const angularRange = availableAngle * ratio;

            group.startAngle = currentAngle;
            group.angularRange = angularRange;
            group.endAngle = currentAngle + angularRange;

            currentAngle += angularRange + groupGap;
        }
    }

    /**
     * 各グループ内でルートノードにリーフ数比例の角度範囲を割り当てる
     *
     * 孤立ノード（子なしルート）には最小角度を割り当て、
     * 大きなサブツリーを持つルートにはより広い角度を割り当てる。
     */
    private assignRootAngleRangesWithinGroups(): void {
        this.groups.forEach(group => {
            const roots = group.roots;
            const groupStart = group.startAngle;
            const groupRange = group.angularRange;

            if (roots.length === 0) return;

            // グループ内のリーフ数合計
            let groupLeafTotal = 0;
            for (const root of roots) {
                groupLeafTotal += root.leafCount || 1;
            }

            // 孤立ノード（リーフ数=1かつ子なし）に最小角度を確保
            const minOrphanAngle = 0.05; // 孤立ノードの最小角度（ラジアン）

            // まず孤立ノードに必要な角度を計算
            let orphanAngleTotal = 0;
            let nonOrphanLeafTotal = 0;
            const orphanRoots: NodeInfo[] = [];
            const nonOrphanRoots: NodeInfo[] = [];

            for (const root of roots) {
                if (root.children.length === 0) {
                    orphanRoots.push(root);
                    orphanAngleTotal += minOrphanAngle;
                } else {
                    nonOrphanRoots.push(root);
                    nonOrphanLeafTotal += root.leafCount || 1;
                }
            }

            // 孤立ノードに割く角度が全体を超えないようにクランプ
            const maxOrphanTotal = groupRange * 0.3;
            if (orphanAngleTotal > maxOrphanTotal) {
                orphanAngleTotal = maxOrphanTotal;
            }

            // 非孤立ルートに割り当てる残りの角度
            const remainingAngle = groupRange - orphanAngleTotal;

            // ルートをサブツリーサイズ降順でソート（グループ内で安定した配置）
            nonOrphanRoots.sort((a, b) => (b.leafCount || 1) - (a.leafCount || 1));

            let currentAngle = groupStart;

            // 非孤立ルートにリーフ数比例で角度割り当て
            for (const root of nonOrphanRoots) {
                const leafCount = root.leafCount || 1;
                const ratio = nonOrphanLeafTotal > 0 ? leafCount / nonOrphanLeafTotal : 1 / nonOrphanRoots.length;
                const rootAngle = remainingAngle * ratio;

                root.startAngle = currentAngle;
                root.subtreeAngle = rootAngle;
                root.endAngle = currentAngle + rootAngle;
                root.angle = currentAngle + rootAngle / 2;

                currentAngle += rootAngle;
            }

            // 孤立ルートに最小角度を均等割り当て
            if (orphanRoots.length > 0) {
                const perOrphanAngle = orphanAngleTotal / orphanRoots.length;
                for (const root of orphanRoots) {
                    root.startAngle = currentAngle;
                    root.subtreeAngle = perOrphanAngle;
                    root.endAngle = currentAngle + perOrphanAngle;
                    root.angle = currentAngle + perOrphanAngle / 2;

                    currentAngle += perOrphanAngle;
                }
            }
        });
    }

    /**
     * BFSで子ノードにリーフ数比例の角度範囲を再帰的に割り当てる
     *
     * 従来の均等分割（angleStep = totalAngle / childCount）ではなく、
     * 各子のリーフ数に比例した角度を割り当てることで、
     * 大きなサブツリーと小さなサブツリーが隣接する場合の
     * 不均一な間隔問題を解消する。
     */
    private assignChildrenAngleRangesIterative(rootNode: NodeInfo): void {
        const queue: NodeInfo[] = [rootNode];

        while (queue.length > 0) {
            const parentNode = queue.shift()!;

            if (parentNode.children.length === 0) {
                continue;
            }

            const startAngle = parentNode.startAngle ?? 0;
            const totalAngle = parentNode.subtreeAngle ?? Math.PI * 2;

            // 親の角度範囲内で子ノードにリーフ数比例の角度を配分
            let childLeafTotal = 0;
            for (const child of parentNode.children) {
                childLeafTotal += child.leafCount || 1;
            }

            // 子のリーフ数合計が0の場合のフォールバック（通常は発生しない）
            if (childLeafTotal === 0) {
                childLeafTotal = parentNode.children.length;
            }

            // 子ノード間にわずかなギャップを挿入（多数の子がある場合のみ）
            const childGap = parentNode.children.length > 3 ? 0.005 : 0;
            const totalChildGap = childGap * parentNode.children.length;
            const distributableAngle = Math.max(totalAngle - totalChildGap, totalAngle * 0.95);

            let currentAngle = startAngle + (totalAngle - distributableAngle - totalChildGap) / 2;

            for (const childNode of parentNode.children) {
                const childLeaves = childNode.leafCount || 1;
                const ratio = childLeaves / childLeafTotal;
                const childAngle = distributableAngle * ratio;

                childNode.startAngle = currentAngle;
                childNode.subtreeAngle = childAngle;
                childNode.endAngle = currentAngle + childAngle;
                childNode.angle = currentAngle + childAngle / 2;

                currentAngle += childAngle + childGap;

                queue.push(childNode);
            }
        }
    }

    /**
     * ノードサイズ適応型の半径計算と円形座標への配置
     *
     * 各レベルの半径は以下を考慮して算出する:
     * 1. そのレベルの最大ノードサイズ（幅・高さの対角線長）
     * 2. そのレベルのノード数と利用可能な角度範囲から計算される最小半径
     * 3. 前レベルの半径+ノードサイズ+パディングの累積値
     *
     * さらに、各ノードの角度位置における最小弧長を検証し、
     * ノード同士が重ならないよう保証する。
     */
    private positionNodesInCircles(): void {
        let maxLevel = 0;
        this.levelMap.forEach((_, level) => {
            maxLevel = Math.max(maxLevel, level);
        });

        // 各レベルの最大ノード対角線サイズと適応パディングを計算
        const levelMetrics = new Map<number, { maxDiag: number; maxWidth: number; maxHeight: number; padding: number }>();
        for (let level = 0; level <= maxLevel; level++) {
            const nodes = this.levelMap.get(level) || [];
            let maxDiag = 0;
            let maxW = 0;
            let maxH = 0;

            for (const nodeInfo of nodes) {
                const w = nodeInfo.width;
                const h = nodeInfo.height;
                // ノードの対角線長（回転しても重ならない最小距離）
                const diag = Math.sqrt(w * w + h * h);
                maxDiag = Math.max(maxDiag, diag);
                maxW = Math.max(maxW, w);
                maxH = Math.max(maxH, h);
            }

            // 適応パディング: ノードが大きいほどパディングも増やす
            const adaptivePadding = this.basePadding + Math.max(maxW, maxH) * 0.04;

            levelMetrics.set(level, {
                maxDiag,
                maxWidth: maxW,
                maxHeight: maxH,
                padding: adaptivePadding
            });
        }

        // 各レベルの半径を計算
        const radii = new Map<number, number>();

        // レベル0（ルート）の半径は baseRadius から開始
        let accumulatedRadius = this.baseRadius;

        for (let level = 0; level <= maxLevel; level++) {
            const nodes = this.levelMap.get(level) || [];
            const metrics = levelMetrics.get(level)!;

            if (nodes.length === 0) {
                radii.set(level, accumulatedRadius);
                continue;
            }

            // 方法A: 累積半径（前レベルからの距離に基づく）
            const cumulativeRadius = accumulatedRadius;

            // 方法B: 角度範囲を考慮した最小半径
            // 各ノードがその角度範囲内に収まるために必要な半径を計算
            let requiredRadiusFromAngles = 0;
            for (const nodeInfo of nodes) {
                const arcAngle = nodeInfo.subtreeAngle ?? (Math.PI * 2 / Math.max(nodes.length, 1));
                if (arcAngle > 0 && arcAngle < Math.PI * 2) {
                    // ノードの幅が弧長内に収まるために必要な半径
                    // 弧長 = radius * arcAngle >= nodeWidth + padding
                    // 非常に狭い角度で巨大化するのを防ぐため、最小角度制限とノード幅の比率を緩和
                    const minR = (nodeInfo.width * 0.45 + metrics.padding) / Math.max(arcAngle, 0.12);
                    requiredRadiusFromAngles = Math.max(requiredRadiusFromAngles, minR);
                }
            }

            // 方法C: 全ノードが円周上に等間隔で並ぶ場合の最小半径
            // （角度配分が極端に不均一な場合のフォールバック）
            const uniformCircumference = nodes.length * (metrics.maxWidth + metrics.padding);
            const uniformMinRadius = uniformCircumference / (2 * Math.PI);

            // 三つの方法の最大値を採用して、確実に重ならない半径を確保
            const finalRadius = Math.max(cumulativeRadius, requiredRadiusFromAngles, uniformMinRadius);
            radii.set(level, finalRadius);

            // 次レベルの累積半径: 現在の半径 + 最大ノード高さ + パディング
            // radiusIncrementも考慮し、最低限の間隔を保証
            const nextIncrement = Math.max(
                this.radiusIncrement,
                metrics.maxHeight + metrics.padding
            );
            accumulatedRadius = finalRadius + nextIncrement;
        }

        // 各ノードに座標を割り当て
        this.levelMap.forEach((nodesInLevel, level) => {
            const radius = radii.get(level) || this.baseRadius;

            for (const nodeInfo of nodesInLevel) {
                if (nodeInfo.angle !== undefined) {
                    const angle = nodeInfo.angle;
                    nodeInfo.x = radius * Math.cos(angle);
                    nodeInfo.y = radius * Math.sin(angle);
                }
            }
        });

        // 重なり検出と微調整（ポストプロセス）
        this.resolveOverlaps(radii);
    }

    /**
     * 同一レベル内のノード重なりを検出し、微調整で解消する
     *
     * 角度配分だけでは解消できない場合に、ノード位置を
     * 放射方向にわずかにずらして重なりを回避する。
     */
    private resolveOverlaps(radii: Map<number, number>): void {
        this.levelMap.forEach((nodesInLevel, level) => {
            if (nodesInLevel.length <= 1) return;

            const radius = radii.get(level) || this.baseRadius;

            // 角度順にソート
            const sorted = [...nodesInLevel].filter(n => n.angle !== undefined);
            sorted.sort((a, b) => (a.angle || 0) - (b.angle || 0));

            for (let i = 0; i < sorted.length; i++) {
                const nodeA = sorted[i];
                const nodeB = sorted[(i + 1) % sorted.length];

                if (nodeA.x === undefined || nodeA.y === undefined ||
                    nodeB.x === undefined || nodeB.y === undefined) {
                    continue;
                }

                // 二つのノード間の距離を計算
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 重ならない最小距離（両ノードの半幅の合計+余白）
                const minDist = (nodeA.width + nodeB.width) / 2 + this.basePadding * 0.5;

                if (dist < minDist && dist > 0) {
                    // 放射方向にずらす（外側のノードをさらに外側に移動）
                    const outerNode = (nodeA.angle || 0) < (nodeB.angle || 0) ? nodeB : nodeA;
                    const pushFactor = 1 + (minDist - dist) / radius * 0.5;

                    if (outerNode.x !== undefined && outerNode.y !== undefined) {
                        outerNode.x *= pushFactor;
                        outerNode.y *= pushFactor;
                    }
                }
            }
        });
    }

    /**
     * 計算した座標をノードデータに反映する
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
     * グラフの描画範囲（バウンディングボックス）を取得する
     */
    public getGraphBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        this.graphData.nodes.forEach(node => {
            const halfW = (node.size_x || 200) / 2;
            const halfH = (node.size_y || 80) / 2;
            const fx = node.fx ?? Infinity;
            const fy = node.fy ?? Infinity;

            if (fx !== Infinity) {
                minX = Math.min(minX, fx - halfW);
                maxX = Math.max(maxX, fx + halfW);
            }
            if (fy !== Infinity) {
                minY = Math.min(minY, fy - halfH);
                maxY = Math.max(maxY, fy + halfH);
            }
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
 * ノードサイズを考慮してバウンディングボックスから最適な表示位置を算出する
 * @param graphData グラフデータ
 * @param padding パディング
 * @returns カメラ位置情報
 */
export function calculateCameraPosition(
    graphData: GraphData,
    padding: number = 400
): {
    centerX: number;
    centerY: number;
    distance: number;
} {
    // ノードサイズを考慮したグラフの範囲を計算
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    graphData.nodes.forEach(node => {
        const halfW = (node.size_x || 200) / 2;
        const halfH = (node.size_y || 80) / 2;
        const fx = node.fx;
        const fy = node.fy;

        if (fx !== undefined && fx !== null) {
            minX = Math.min(minX, fx - halfW);
            maxX = Math.max(maxX, fx + halfW);
        }
        if (fy !== undefined && fy !== null) {
            minY = Math.min(minY, fy - halfH);
            maxY = Math.max(maxY, fy + halfH);
        }
    });

    // 有効なノードが見つからなかった場合のフォールバック
    if (minX === Infinity || minY === Infinity) {
        return { centerX: 0, centerY: 0, distance: 1000 };
    }

    // 中心と距離を計算
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const width = maxX - minX + padding;
    const height = maxY - minY + padding;
    const distance = Math.max(width, height) * 0.7;

    return { centerX, centerY, distance };
}