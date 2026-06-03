import * as THREE from 'three';

export interface NodeData {
    id: number;
    img: string;
    name?: string;
    _originalX?: number;
    _originalY?: number;
    _originalZ?: number;
    _tempX?: number;
    _tempY?: number;
    _tempZ?: number;
    group?: number;
    groupId?: number;  // グループID
    groupIds?: number[]; // 所属するグループID一覧
    x?: number;
    y?: number;
    z?: number;
    fx?: number;
    fy?: number;
    fz?: number;
    isNew?: boolean;
    deadline?: string;
    createdAt?: string;
    updatedAt?: string;
    disabled?: boolean;
    type?: string;      // "folder" | "file" | "link" | "issue" | "task" 等
    folder_path?: string;  // フォルダパス
    style_id?: number;  // 3Dモデルなどのスタイル指定
    scale?: number;     // 3Dオブジェクトのスケール (0.3 to 2.0)
    size_x?: number;    // ノードの幅
    size_y?: number;    // ノードの高さ
    rot_x?: number;
    rot_y?: number;
    _isPinned?: boolean;
}

export interface GroupData {
    id: number;
    name: string;
    color: string;
    shape?: 'cloud' | 'aura';
}

export interface GraphData {
    nodes: NodeData[];
    links: any[];
    globalBackground?: string;
    groups?: GroupData[];
}

export interface GroupVisual {
    nodeBubbles: Map<number, THREE.Sprite[]>; // nodeId -> Sprite array
    linkTubes: Map<string, THREE.Sprite[]>;  // linkKey -> Sprite array
    sprite: any;
    groupId: number;
}
