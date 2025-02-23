import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Modal, Input, Button, Flex, Select } from 'antd';
import _ from 'lodash';

interface ModalRef {
    showModal: (data: any) => void;
}

interface NodeEditorProps {
    onRefreshNode: (node: any) => void;
    onDeleteNode: (node: any) => void;
}

const NodeEditor = forwardRef<ModalRef, NodeEditorProps>((props, ref) => {
    const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
    const [contents, setContents] = useState("");
    const [styleId, setStyleId] = useState<number>(1);
    const [deadline, setDeadline] = useState<string>("");
    const [priority, setPriority] = useState<number | null>(null); // デフォルト: 未選択
    interface Node {
        name: string;
        isNew?: boolean;
        style_id?: number;
        deadline?: string;
        priority?: number | null;
    }
    
    const [editNode, setEditNode] = useState<Node | null>(null);

    useImperativeHandle(ref, () => ({
        showModal: (node: any) => {
            setContents(node.name);
            setStyleId(node.style_id || 1);
            setDeadline(node.deadline || "");
            setPriority(node.priority !== undefined ? node.priority : null); // デフォルト: 未選択
            setIsNodeEditorOpen(true);
            setEditNode(node);
        }
    }));

    const handleOk = () => {
        setIsNodeEditorOpen(false);
        if (editNode){
            editNode.name = contents;
            editNode.style_id = styleId;
            editNode.deadline = deadline;
            if (priority === null) {
                delete editNode.priority;
            } else {
                editNode.priority = priority;
            }
        }
        props.onRefreshNode(editNode);
    };
  
    const handleCancel = () => {
        setIsNodeEditorOpen(false);
        if (editNode && _.has(editNode, 'isNew') && editNode.isNew){
            props.onDeleteNode(editNode);
        }
    };

    return (
        <>
          <Modal 
            title="Edit Node" 
            open={isNodeEditorOpen} 
            onOk={handleOk} 
            onCancel={handleCancel}
            footer={
              <Flex justify="space-between" align="center">
                {editNode && !editNode.isNew && (
                  <Button danger onClick={() => {
                    if (editNode) {
                      props.onDeleteNode(editNode);
                      setIsNodeEditorOpen(false);
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
                  if (textarea) textarea.focus();
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
          </Flex>
          </Modal>
        </>
      );
});

export default NodeEditor;
