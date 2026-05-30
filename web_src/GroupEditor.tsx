import React, { useState, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { Input, Button, Flex, ColorPicker, Select, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, GroupOutlined } from '@ant-design/icons';
import _ from 'lodash';

interface ModalRef {
    showModal: (group: any, initialMemberIds: number[], coords?: { x: number, y: number }, isNew?: boolean) => void;
}

interface GroupEditorProps {
    onSaveGroup: (group: any, nodeIds: number[]) => void;
    onDeleteGroup: (groupId: number) => void;
    onClose: () => void;
    open: boolean;
    allNodes: any[];
    getNodeScreenCoords?: (node: any) => { x: number, y: number } | null | undefined;
    activeNode: any;
    onPreviewGroup?: (group: any, nodeIds: number[]) => void;
}

const PRESET_COLORS = [
    '#4c9ac0', // 青
    '#3aaa6a', // 緑
    '#c8a000', // 黄
    '#d06020', // 橙
    '#c04070', // ピンク
    '#7040c0', // 紫
    '#808080', // グレー
];
const PRESET_LABELS = ['青', '緑', '黄', '橙', 'ピンク', '紫', 'グレー'];

const GroupEditor = forwardRef<ModalRef, GroupEditorProps>((props, ref) => {
    const [groupName, setGroupName] = useState<string>('');
    const [groupColor, setGroupColor] = useState<string>('#4c9ac0');
    const [memberNodeIds, setMemberNodeIds] = useState<number[]>([]);
    const [selectedNodeToAdd, setSelectedNodeToAdd] = useState<number | undefined>(undefined);
    const [popupCoords, setPopupCoords] = useState<{ x: number, y: number } | null>(null);
    const [editGroup, setEditGroup] = useState<any>(null);
    const [groupShape, setGroupShape] = useState<string>('cloud');

    const originalGroupRef = useRef<any>(null);
    const originalMemberNodeIdsRef = useRef<number[]>([]);
    const isNewGroupRef = useRef<boolean>(false);

    useImperativeHandle(ref, () => ({
        showModal: (group: any, initialMemberIds: number[], coords?: { x: number, y: number }, isNew?: boolean) => {
            setEditGroup(group);
            setGroupName(group.name || `グループ ${group.id}`);
            setGroupColor(group.color || '#4c9ac0');
            setGroupShape(group.shape || 'cloud');
            setMemberNodeIds(initialMemberIds);
            setSelectedNodeToAdd(undefined);
            setPopupCoords(coords || null);

            isNewGroupRef.current = !!isNew;
            originalGroupRef.current = _.cloneDeep(group);
            originalMemberNodeIdsRef.current = [...initialMemberIds];
        }
    }));

    // スクリーン座標を動的に更新
    useEffect(() => {
        if (!props.open || !props.activeNode || !props.getNodeScreenCoords) return;

        let active = true;
        const updateCoords = () => {
            if (!active) return;
            const currentCoords = props.getNodeScreenCoords?.(props.activeNode);
            if (currentCoords) {
                if (!isNaN(currentCoords.x) && !isNaN(currentCoords.y)) {
                    setPopupCoords(currentCoords);
                }
            }
            requestAnimationFrame(updateCoords);
        };
        requestAnimationFrame(updateCoords);

        return () => {
            active = false;
        };
    }, [props.open, props.activeNode, props.getNodeScreenCoords]);

    // グループ編集の変更を検知してプレビュー反映
    useEffect(() => {
        if (props.open && editGroup && props.onPreviewGroup) {
            props.onPreviewGroup({
                ...editGroup,
                name: groupName,
                color: groupColor,
                shape: groupShape
            }, memberNodeIds);
        }
    }, [groupName, groupColor, groupShape, memberNodeIds, editGroup, props.open, props.onPreviewGroup]);

    // ノード追加時の処理
    const handleAddNode = () => {
        if (selectedNodeToAdd !== undefined && !memberNodeIds.includes(selectedNodeToAdd)) {
            setMemberNodeIds(prev => [...prev, selectedNodeToAdd]);
            setSelectedNodeToAdd(undefined);
        }
    };

    // ノード削除時の処理
    const handleRemoveNode = (nodeId: number) => {
        setMemberNodeIds(prev => prev.filter(id => id !== nodeId));
    };

    const handleOk = () => {
        if (editGroup) {
            props.onSaveGroup({
                ...editGroup,
                name: groupName,
                color: groupColor,
                shape: groupShape
            }, memberNodeIds);
        }
        props.onClose();
    };

    const handleCancel = () => {
        if (isNewGroupRef.current) {
            props.onDeleteGroup(editGroup.id);
        } else if (originalGroupRef.current && props.onPreviewGroup) {
            props.onPreviewGroup(originalGroupRef.current, originalMemberNodeIdsRef.current);
        }
        props.onClose();
    };

    // 表示位置の計算
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const popupWidth = 460;
    const popupHeight = 520;

    let left = windowWidth / 2 - popupWidth / 2;
    let top = Math.max(50, windowHeight / 2 - popupHeight / 2);

    if (popupCoords) {
        const halfWidth = (props.activeNode?.size_x || 200) / 2;
        if (popupCoords.x < windowWidth / 2) {
            left = popupCoords.x + halfWidth + 24;
        } else {
            left = popupCoords.x - halfWidth - popupWidth - 24;
        }
        top = Math.max(20, Math.min(windowHeight - popupHeight - 20, popupCoords.y - popupHeight / 2));
    }

    if (!props.open || !editGroup) return null;

    // 追加可能な（まだグループに入っていない）ノードの一覧
    const addableNodes = props.allNodes.filter(n => !memberNodeIds.includes(n.id));

    return (
        <div 
            className="group-editor-popup"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                background: 'transparent',
                pointerEvents: 'auto',
            }}
            onClick={handleCancel}
        >
            <div 
                style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${popupWidth}px`,
                    background: '#ffffff',
                    borderRadius: '16px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15), 0 1px 8px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #f0f0f0',
                    padding: '20px',
                    boxSizing: 'border-box',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ヘッダー領域 */}
                <div style={{ marginBottom: '16px' }}>
                    <Flex align="center" gap="small">
                        <GroupOutlined rev="" style={{ fontSize: '20px', color: '#1890ff' }} />
                        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                            グループ設定
                        </span>
                    </Flex>
                </div>

                {/* メイン入力フォーム */}
                <Flex vertical gap="middle" style={{ maxHeight: '360px', overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>
                    {/* グループ名 */}
                    <Flex vertical gap="4px">
                        <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>グループ名</span>
                        <Input 
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="グループ名を入力"
                        />
                    </Flex>

                    {/* グループの形状 */}
                    <Flex vertical gap="4px">
                        <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>グループの形状</span>
                        <Select
                            value={groupShape}
                            onChange={(value) => setGroupShape(value)}
                            options={[
                                { value: 'cloud', label: '雲 (Cloud)' },
                                { value: 'aura', label: '発光オーラ (Glowing Aura)' }
                            ]}
                        />
                    </Flex>

                    {/* 霧の色 */}
                    <Flex vertical gap="6px">
                        <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>霧の色（空間囲み）</span>
                        <Flex gap="8px" align="center" wrap="wrap">
                            {PRESET_COLORS.map((color, idx) => (
                                <div
                                    key={idx}
                                    title={PRESET_LABELS[idx]}
                                    onClick={() => setGroupColor(color)}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: '50%',
                                        background: color,
                                        border: groupColor === color ? '3px solid #333' : '2px solid #ccc',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                />
                            ))}
                            <ColorPicker
                                value={groupColor}
                                onChange={(color) => setGroupColor(color.toHexString())}
                                size="small"
                                trigger="click"
                            />
                        </Flex>
                    </Flex>

                    <Divider style={{ margin: '8px 0' }} />

                    {/* グループメンバー一覧 */}
                    <Flex vertical gap="8px">
                        <span style={{ fontSize: '13px', color: '#666', fontWeight: '500' }}>
                            グループメンバー ({memberNodeIds.length})
                        </span>
                        
                        {/* メンバーリスト */}
                        <div style={{
                            border: '1px solid #f0f0f0',
                            borderRadius: '8px',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            padding: '8px',
                            background: '#fafafa',
                        }}>
                            {memberNodeIds.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#aaa', padding: '12px 0', fontSize: '12px' }}>
                                    メンバーが存在しません。
                                </div>
                            ) : (
                                memberNodeIds.map(nodeId => {
                                    const node = props.allNodes.find(n => n.id === nodeId);
                                    if (!node) return null;
                                    return (
                                        <Flex key={nodeId} justify="space-between" align="center" style={{ padding: '4px 8px', background: '#fff', borderRadius: '4px', marginBottom: '4px', border: '1px solid #f0f0f0' }}>
                                            <span style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                                {node.name || `ノード ${node.id}`}
                                            </span>
                                            <Button 
                                                type="text" 
                                                danger 
                                                size="small" 
                                                icon={<DeleteOutlined rev="" />} 
                                                onClick={() => handleRemoveNode(nodeId)} 
                                            />
                                        </Flex>
                                    );
                                })
                            )}
                        </div>

                        {/* メンバー追加コントロール */}
                        <Flex gap="small" style={{ marginTop: '4px' }}>
                            <Select
                                showSearch
                                style={{ flex: 1 }}
                                placeholder="追加するノードを選択"
                                optionFilterProp="label"
                                value={selectedNodeToAdd}
                                onChange={(value) => setSelectedNodeToAdd(value)}
                                options={addableNodes.map(n => ({
                                    value: n.id,
                                    label: n.name || `ノード ${n.id}`
                                }))}
                            />
                            <Button 
                                type="primary" 
                                icon={<PlusOutlined rev="" />} 
                                onClick={handleAddNode}
                                disabled={selectedNodeToAdd === undefined}
                            >
                                追加
                            </Button>
                        </Flex>
                    </Flex>
                </Flex>

                {/* フッター領域 */}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px', marginTop: '8px' }}>
                    <Flex justify="space-between" align="center">
                        <Button danger onClick={() => {
                            props.onDeleteGroup(editGroup.id);
                            props.onClose();
                        }}>
                            グループ削除
                        </Button>
                        <Flex gap="small">
                            <Button onClick={handleCancel}>
                                キャンセル
                            </Button>
                            <Button type="primary" onClick={handleOk}>
                                OK
                            </Button>
                        </Flex>
                    </Flex>
                </div>
            </div>
        </div>
    );
});

export default GroupEditor;
