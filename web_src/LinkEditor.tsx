import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Modal, Input, Button, Flex, Typography, Select, message } from 'antd';  
import _ from 'lodash';

interface ModalRef {
    showModal: (data: any) => void;
}

interface LinkEditorProps {
    onRefreshLink: (link: any) => void;
    onDeleteLink: (link: any) => void;
    onSelectNode: (node: any) => void;
    onClose: () => void;
    open: boolean;
    links?: any[];
}

interface Link {
    name: string;
    source: any;
    target: any;
    index: number;
    isNew?: boolean;
    type?: string;
}

// 循環親子関係を検出するための深さ優先/幅優先探索ヘルパー
function hasParentChildPath(startNodeId: any, targetNodeId: any, links: any[]): boolean {
    const visited = new Set<string>();
    const queue = [String(startNodeId)];
    visited.add(String(startNodeId));

    while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === String(targetNodeId)) {
            return true;
        }

        for (const link of links) {
            if (link.type === 'friend') {
                continue;
            }

            const sId = (link.source && typeof link.source === 'object') ? link.source.id : link.source;
            const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;

            if (String(sId) === curr) {
                const nextId = String(tId);
                if (!visited.has(nextId)) {
                    visited.add(nextId);
                    queue.push(nextId);
                }
            }
        }
    }
    return false;
}

// ノードがすでに別の親子リンク（親）を持っているかチェックするヘルパー
function hasParent(nodeId: any, links: any[], excludeLinkIndex?: number): boolean {
    return links.some(link => {
        if (link.type === 'friend') {
            return false;
        }
        if (excludeLinkIndex !== undefined && link.index === excludeLinkIndex) {
            return false;
        }
        const tId = (link.target && typeof link.target === 'object') ? link.target.id : link.target;
        return String(tId) === String(nodeId);
    });
}

const LinkEditor = forwardRef<ModalRef, LinkEditorProps>((props, ref) => {
    const [contents, setContents] = useState("");
    const [type, setType] = useState<string>("parent-child");
    const [editLink, setEditLink] = useState<Link | null>(null);
       
    useImperativeHandle(ref, () => ({
        showModal: (link: any) => {
            setContents(link.name || "");
            setType(link.type || "parent-child");
            setEditLink(link);
        }
    }));

    const handleOk = () => {
        if (editLink) {
            // 循環親子関係および単一親制約のチェック：親子リンクに変更する場合のみチェック
            if (type === 'parent-child') {
                const sourceId = (editLink.source && typeof editLink.source === 'object') ? editLink.source.id : editLink.source;
                const targetId = (editLink.target && typeof editLink.target === 'object') ? editLink.target.id : editLink.target;
                
                // 自分自身以外のリンクでチェック
                const otherLinks = (props.links || []).filter((l: any) => l.index !== editLink.index);
                
                if (hasParentChildPath(targetId, sourceId, otherLinks)) {
                    message.error('循環親子関係になるため、親子リンクに変更することはできません。');
                    return;
                }
                
                if (hasParent(targetId, props.links || [], editLink.index)) {
                    message.error('接続先ノードにはすでに親ノードが存在するため、親子リンクに変更することはできません。');
                    return;
                }
            }

            props.onClose();
            // 元のリンクをディープコピーして、そのコピーに変更を適用する
            const linkToUpdate = _.cloneDeep(editLink);
            linkToUpdate.name = contents;
            linkToUpdate.type = type;
            linkToUpdate.source = editLink.source;
            linkToUpdate.target = editLink.target;
            props.onRefreshLink(linkToUpdate);
        } else {
            props.onClose();
        }
    };
  
    const handleCancel = () => {
        props.onClose();
    };

    return (
        <>
          <Modal 
            title="Edit Link" 
            open={props.open} 
            onOk={handleOk} 
            onCancel={handleCancel}
            footer={
              <Flex justify="space-between" align="center">
                {editLink && !editLink.isNew && (
                  <Button danger onClick={() => {
                    if (editLink) {
                      props.onDeleteLink(editLink);
                      props.onClose();
                    }
                  }}>
                    削除
                  </Button>
                )}
                <Flex gap="small" style={{ marginLeft: editLink?.isNew ? 'auto' : 0 }}>
                  <Button onClick={handleCancel}>
                    キャンセル
                  </Button>
                  <Button type="primary" onClick={handleOk}>
                    OK
                  </Button>
                </Flex>
              </Flex>
            }
            afterOpenChange={(visible) => {
              if (visible) {
                setTimeout(() => {
                  const input = document.querySelector('.ant-modal input') as HTMLInputElement;
                  if (input) input.focus();
                }, 100);
              }
            }}
          >
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Typography.Text style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                リンク名
              </Typography.Text>
              <Input 
                placeholder="Link Name" 
                value={contents} 
                onChange={(e)=>setContents(e.target.value)}
                onPressEnter={handleOk}
              />
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <Typography.Text style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                リンクタイプ
              </Typography.Text>
              <Select
                value={type}
                onChange={(value) => {
                  if (value === 'parent-child') {
                    if (editLink) {
                      const sourceId = (editLink.source && typeof editLink.source === 'object') ? editLink.source.id : editLink.source;
                      const targetId = (editLink.target && typeof editLink.target === 'object') ? editLink.target.id : editLink.target;
                      
                      const otherLinks = (props.links || []).filter((l: any) => l.index !== editLink.index);
                      
                      if (hasParentChildPath(targetId, sourceId, otherLinks)) {
                        message.error('循環親子関係になるため、親子リンクに変更することはできません。');
                        return;
                      }
                      
                      if (hasParent(targetId, props.links || [], editLink.index)) {
                        message.error('接続先ノードにはすでに親ノードが存在するため、親子リンクに変更することはできません。');
                        return;
                      }
                    }
                  }
                  setType(value);
                }}
                style={{ width: '100%' }}
                options={[
                  { value: 'parent-child', label: '親子関係' },
                  { value: 'friend', label: '友達関係' }
                ]}
              />
            </div>
            
            {editLink && (
              <Flex justify="space-between" align="center" style={{ marginTop: '20px', width: '100%', borderTop: '1px solid #f0f0f0', paddingTop: '12px' }}>
                <div style={{ width: '45%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Typography.Link 
                    onClick={() => {
                      props.onSelectNode(editLink.source);
                      props.onClose();
                    }}
                    style={{ width: '100%', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}
                  >
                    {(editLink.source.name || '名称未設定').length > 20 
                      ? `${(editLink.source.name || '名称未設定').slice(0, 20)}...` 
                      : (editLink.source.name || '名称未設定')}
                  </Typography.Link>
                </div>
                <span style={{ margin: '0 10px' }}>→</span>
                <div style={{ width: '45%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <Typography.Link
                    onClick={() => {
                      props.onSelectNode(editLink.target);
                      props.onClose();
                    }}
                    style={{ width: '100%', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden' }}
                  >
                    {(editLink.target.name || '名称未設定').length > 20 
                      ? `${(editLink.target.name || '名称未設定').slice(0, 20)}...` 
                      : (editLink.target.name || '名称未設定')}
                  </Typography.Link>
                </div>
              </Flex>
            )}
          </div>
          </Modal>
        </>
    );
});
    
export default LinkEditor;
