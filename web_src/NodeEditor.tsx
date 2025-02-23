import React,{useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Modal, Input, Button, Flex, Select } from 'antd';
import _ from 'lodash';

interface ModalRef {
    showModal: (data: any) => void;
}

interface NodeEditorProps {
    onRefreshNode: (node: any) => void;
    onDeleteNode: (node: any) => void;
    onClose: () => void;
    open: boolean;
}

const NodeEditor = forwardRef<ModalRef, NodeEditorProps>((props, ref) => {
    const [contents, setContents] = useState("");
    const [styleId, setStyleId] = useState<number>(1);
    const [deadline, setDeadline] = useState<string>("");
    const [priority, setPriority] = useState<number | null>(null); // デフォルト: 未選択
    const [urgency, setUrgency] = useState<number | null>(null); // デフォルト: 未選択
    interface Node {
        name: string;
        isNew?: boolean;
        style_id?: number;
        deadline?: string;
        priority?: number | null;
        urgency?: number | null;
    }
    
    const [editNode, setEditNode] = useState<Node | null>(null);

    useImperativeHandle(ref, () => ({
        showModal: (node: any) => {
            setContents(node.name);
            setStyleId(node.style_id || 1);
            setDeadline(node.deadline || "");
            setPriority(node.priority !== undefined ? node.priority : null); // デフォルト: 未選択
            setUrgency(node.urgency !== undefined ? node.urgency : null); // デフォルト: 未選択
            setEditNode(node);
        }
    }));

    const handleOk = () => {
        if (editNode){
            editNode.name = contents;
            editNode.style_id = styleId;
            editNode.deadline = deadline;
            if (priority === null) {
                delete editNode.priority;
            } else {
                editNode.priority = priority;
            }
            if (urgency === null) {
                delete editNode.urgency;
            } else {
                editNode.urgency = urgency;
            }
            props.onRefreshNode(editNode);
        }
        props.onClose();
    };
  
    const handleCancel = () => {
        props.onClose();
        if (editNode && _.has(editNode, 'isNew') && editNode.isNew){
            props.onDeleteNode(editNode);
        }
    };

    return (
        <>
          <Modal 
            title="Edit Node" 
            open={props.open} 
            onOk={handleOk} 
            onCancel={handleCancel}
            footer={
              <Flex justify="space-between" align="center">
                {editNode && !editNode.isNew && (
                  <Button danger onClick={() => {
                    if (editNode) {
                      props.onDeleteNode(editNode);
                      props.onClose();
                    }
                  }}>
                    削除
                  </Button>
                )}
                <Flex gap="small" style={{ marginLeft: editNode?.isNew ? 'auto' : 0 }}>
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
                  const textarea = document.querySelector('.ant-modal textarea') as HTMLTextAreaElement;
                  if (textarea) {
                    textarea.focus();
                  }
                }, 100);
              }
            }}
          >
          <Flex vertical gap="small">
            <Input.TextArea 
              placeholder="Contents" 
              value={contents} 
              onChange={(e) => setContents(e.target.value)}
              autoSize={{ minRows: 3, maxRows: 6 }}
              onPressEnter={(e) => {
                if (e.shiftKey) {
                  e.preventDefault();
                  handleOk();
                }
              }}
            />
            <Select
              value={styleId}
              onChange={(value) => setStyleId(value)}
              options={[
                { value: 1, label: 'スタイル1' },
                { value: 2, label: 'スタイル2' },
                { value: 3, label: 'スタイル3' },
                { value: 4, label: 'スタイル4' },
                { value: 5, label: 'スタイル5' },
                { value: 6, label: 'スタイル6' },
              ]}
            />
            <Input
              type="datetime-local"
              placeholder="期限"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <Select
              value={priority}
              onChange={(value) => setPriority(value)}
              options={[
                { value: null, label: '未選択' },
                { value: 1, label: '最低' },
                { value: 2, label: '低' },
                { value: 3, label: '中' },
                { value: 4, label: '高' },
                { value: 5, label: '最高' },
              ]}
            />
            <Select
              value={urgency}
              onChange={(value) => setUrgency(value)}
              options={[
                { value: null, label: '未選択' },
                { value: 1, label: '最低' },
                { value: 2, label: '低' },
                { value: 3, label: '中' },
                { value: 4, label: '高' },
                { value: 5, label: '最高' },
              ]}
              placeholder="緊急度"
            />
          </Flex>
          </Modal>
        </>
      );
});

export default NodeEditor;
