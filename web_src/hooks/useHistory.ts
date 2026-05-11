import { useRef, useState, useCallback } from 'react';
import { cloneDeep } from 'lodash';

export interface HistoryItem {
    action: 'add_node' | 'delete_node' | 'edit_node' | 'move_node' | 'add_link' | 'delete_link' | 'edit_link';
    data: any;
    timestamp: number;
}

export const useHistory = () => {
    const historyRef = useRef<HistoryItem[]>([]);
    const historyIndexRef = useRef<number>(-1);
    const [_, forceUpdate] = useState({});
    const lastUndoTime = useRef<number>(0);
    const lastRedoTime = useRef<number>(0);
    const DEBOUNCE_MS = 100;

    const addToHistory = useCallback((action: HistoryItem['action'], data: any) => {
        // 必要な部分のみをクローン
        const clonedData = action === 'move_node' ? 
            { id: data.id, fx: data.fx, fy: data.fy, fz: data.fz } : 
            cloneDeep(data);

        // Refを直接更新
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
        historyRef.current.push({
            action,
            data: clonedData,
            timestamp: Date.now()
        });
        historyIndexRef.current = historyRef.current.length - 1;

        // UIの再描画が必要な場合のみforceUpdate
        if (['add_node', 'delete_node', 'edit_node'].includes(action)) {
            forceUpdate({});
        }
    }, []);

    const undo = useCallback((graphData: any, callbacks: {
        deleteNode: (id: number) => void;
        deleteLink: (link: any) => void;
        setGraphData: (data: any) => void;
        refreshLink: (link: any) => void;
    }): boolean => {
        const now = Date.now();
        if (now - lastUndoTime.current < DEBOUNCE_MS) {
            return false; // ignore rapid repeated calls
        }
        lastUndoTime.current = now;
        if (historyIndexRef.current >= 0) {
            const item = historyRef.current[historyIndexRef.current];
            
            // アクションの種類に応じて元に戻す処理
            switch (item.action) {
                case 'add_node':
                    // ノード追加を元に戻す（削除）
                    callbacks.deleteNode(item.data.node.id);
                    item.data.links.forEach((link: any) => {
                        callbacks.setGraphData((prevData: any) => ({
                            ...prevData,
                            links: prevData.links.filter((l: any) => l.index !== link.index)
                        }));
                    });
                    break;
                case 'delete_node':
                    // ノード削除を元に戻す（追加）
                    graphData.nodes.push(item.data.node);
                    // 関連するリンクも復元
                    item.data.links.forEach((link: any) => {
                        graphData.links.push(link);
                        link.source = graphData.nodes.find((n: any) => n.id === link.source.id);
                        link.target = graphData.nodes.find((n: any) => n.id === link.target.id);
                    });
                    break;
                case 'edit_node':
                    // ノード編集を元に戻す
                    const nodeToRestore = graphData.nodes.find((n: any) => n.id === item.data.before.id);
                    if (nodeToRestore) {
                        // 内部プロパティを破壊しないように、必要なプロパティのみを上書きする
                        const keysToRestore = ['name', 'group', 'style_id', 'deadline', 'priority', 'urgency', 'disabled', 'icon_img', 'icon_size', 'type', 'url', 'file_path', 'folder_path', 'scale', 'background'];
                        keysToRestore.forEach(key => {
                            if (item.data.before[key] !== undefined) {
                                nodeToRestore[key] = item.data.before[key];
                            } else {
                                delete nodeToRestore[key];
                            }
                        });
                        if (item.data.before.size_x !== undefined) nodeToRestore.size_x = item.data.before.size_x;
                        if (item.data.before.size_y !== undefined) nodeToRestore.size_y = item.data.before.size_y;
                        if (item.data.before.img !== undefined) nodeToRestore.img = item.data.before.img;

                        graphData.links.forEach((link: any) => {
                            if (link.source.id === item.data.before.id) {
                                link.source = nodeToRestore;
                            }
                            if (link.target.id === item.data.before.id) {
                                link.target = nodeToRestore;
                            }
                        });
                    }
                    break;
                case 'move_node':
                    // ノード移動を元に戻す
                    const nodeToMove = graphData.nodes.find((n: any) => n.id === item.data.id);
                    if (nodeToMove) {
                        const nodeIndex = graphData.nodes.findIndex((n: any) => n.id === item.data.id);
                        if (nodeIndex !== -1) {
                            item.data.px = graphData.nodes[nodeIndex].fx;
                            item.data.py = graphData.nodes[nodeIndex].fy;
                            item.data.pz = graphData.nodes[nodeIndex].fz;

                            graphData.nodes[nodeIndex].fx = item.data.fx;
                            graphData.nodes[nodeIndex].fy = item.data.fy;
                            graphData.nodes[nodeIndex].fz = item.data.fz;
                            
                            // 見た目も即座に反映
                            if (item.data.fx !== undefined) graphData.nodes[nodeIndex].x = item.data.fx;
                            if (item.data.fy !== undefined) graphData.nodes[nodeIndex].y = item.data.fy;
                            if (item.data.fz !== undefined) graphData.nodes[nodeIndex].z = item.data.fz;
                        }
                    }
                    break;
                case 'add_link':
                    // リンク追加を元に戻す（削除）
                    callbacks.deleteLink(item.data);
                    break;
                case 'delete_link':
                    // リンク削除を元に戻す（追加）
                    graphData.links.push(item.data);
                    item.data.source = graphData.nodes.find((n: any) => n.id === item.data.source.id);
                    item.data.target = graphData.nodes.find((n: any) => n.id === item.data.target.id);
                    break;
                case 'edit_link':
                    // リンク編集を元に戻す
                    const linkToRestore = graphData.links.find((l: any) => l.index === item.data.before.index);
                    if (linkToRestore) {
                        linkToRestore.name = item.data.before.name;
                        callbacks.refreshLink(linkToRestore);
                    }
                    break;
            }

            // 同期的にインデックスを更新
            historyIndexRef.current--;
            
            // UIの再描画は非同期で実行
            setTimeout(() => {
                forceUpdate({});
            }, 0);
            
            return true;
        }
        return false;
    }, []);

    const redo = useCallback((graphData: any, callbacks: {
        deleteNode: (id: number) => void;
        deleteLink: (link: any) => void;
        setGraphData: (data: any) => void;
        refreshLink: (link: any) => void;
    }): boolean => {
        const now = Date.now();
        if (now - lastRedoTime.current < DEBOUNCE_MS) {
            return false; // ignore rapid repeated calls
        }
        lastRedoTime.current = now;
        if (historyIndexRef.current < historyRef.current.length - 1) {
            const item = historyRef.current[historyIndexRef.current + 1];
            
            // アクションの種類に応じてやり直し処理
            switch (item.action) {
                case 'add_node':
                    // ノード追加をやり直す
                    graphData.nodes.push(item.data.node);
                    item.data.links.forEach((link: any) => {
                        graphData.links.push(link);
                        link.source = graphData.nodes.find((n: any) => n.id === link.source.id);
                        link.target = graphData.nodes.find((n: any) => n.id === link.target.id);
                    });
                    break;
                case 'delete_node':
                    // ノード削除をやり直す
                    callbacks.deleteNode(item.data.node.id);
                    break;
                case 'edit_node':
                    // ノード編集をやり直す
                    const nodeToEdit = graphData.nodes.find((n: any) => n.id === item.data.after.id);
                    if (nodeToEdit) {
                        const keysToRestore = ['name', 'group', 'style_id', 'deadline', 'priority', 'urgency', 'disabled', 'icon_img', 'icon_size', 'type', 'url', 'file_path', 'folder_path', 'scale', 'background'];
                        keysToRestore.forEach(key => {
                            if (item.data.after[key] !== undefined) {
                                nodeToEdit[key] = item.data.after[key];
                            } else {
                                delete nodeToEdit[key];
                            }
                        });
                        if (item.data.after.size_x !== undefined) nodeToEdit.size_x = item.data.after.size_x;
                        if (item.data.after.size_y !== undefined) nodeToEdit.size_y = item.data.after.size_y;
                        if (item.data.after.img !== undefined) nodeToEdit.img = item.data.after.img;

                        graphData.links.forEach((link: any) => {
                            if (link.source.id === item.data.after.id) {
                                link.source = nodeToEdit;
                            }
                            if (link.target.id === item.data.after.id) {
                                link.target = nodeToEdit;
                            }
                        });
                    }
                    break;
                case 'move_node':
                    // ノード移動をやり直す
                    const nodeToMove = graphData.nodes.find((n: any) => n.id === item.data.id);
                    if (nodeToMove) {
                        const nodeIndex = graphData.nodes.findIndex((n: any) => n.id === item.data.id);
                        if (nodeIndex !== -1) {
                            graphData.nodes[nodeIndex].fx = item.data.px;
                            graphData.nodes[nodeIndex].fy = item.data.py;
                            graphData.nodes[nodeIndex].fz = item.data.pz;
                            
                            // 見た目も即座に反映
                            if (item.data.px !== undefined) graphData.nodes[nodeIndex].x = item.data.px;
                            if (item.data.py !== undefined) graphData.nodes[nodeIndex].y = item.data.py;
                            if (item.data.pz !== undefined) graphData.nodes[nodeIndex].z = item.data.pz;
                        }
                    }
                    break;
                case 'add_link':
                    // リンク追加をやり直す
                    graphData.links.push(item.data);
                    item.data.source = graphData.nodes.find((n: any) => n.id === item.data.source.id);
                    item.data.target = graphData.nodes.find((n: any) => n.id === item.data.target.id);
                    break;
                case 'delete_link':
                    // リンク削除をやり直す
                    callbacks.deleteLink(item.data);
                    break;
                case 'edit_link':
                    // リンク編集をやり直す
                    const linkToEdit = graphData.links.find((l: any) => l.index === item.data.after.index);
                    if (linkToEdit) {
                        linkToEdit.name = item.data.after.name;
                        callbacks.refreshLink(linkToEdit);
                    }
                    break;
            }

            // 同期的にインデックスを更新
            historyIndexRef.current++;
            
            // UIの再描画は非同期で実行
            setTimeout(() => {
                forceUpdate({});
            }, 0);
            
            return true;
        }
        return false;
    }, []);

    return {
        addToHistory,
        undo,
        redo,
        canUndo: () => historyIndexRef.current >= 0,
        canRedo: () => historyIndexRef.current < historyRef.current.length - 1
    };
}; 