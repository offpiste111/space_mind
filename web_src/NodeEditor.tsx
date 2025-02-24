import React,{useState, forwardRef, useImperativeHandle, useEffect } from 'react'
import { Modal, Input, Button, Flex, Select, Upload } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import _ from 'lodash';
import type { UploadProps } from 'antd';

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
        disabled?: boolean;
        icon_img?: string;
    }
    
    const [editNode, setEditNode] = useState<Node | null>(null);
    const [iconImg, setIconImg] = useState<string>("");

    const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const uploadProps: UploadProps = {
        name: 'file',
        multiple: false,
        showUploadList: false,
        beforeUpload: async (file) => {
            if (!file.type.startsWith('image/')) {
                return false;
            }
            const base64 = await getBase64(file);
            setIconImg(base64);
            return false;
        },
        customRequest: () => {},
    };

    useImperativeHandle(ref, () => ({
        showModal: (node: any) => {
            setContents(node.name);
            setStyleId(node.style_id || 1);
            setDeadline(node.deadline || "");
            setPriority(node.priority !== undefined ? node.priority : null);
            setUrgency(node.urgency !== undefined ? node.urgency : null);
            setIconImg(node.icon_img || "");
            setEditNode(node);
        }
    }));

    const handleOk = () => {
        if (editNode){
            editNode.name = contents;
            editNode.style_id = styleId;
            editNode.deadline = deadline;
            editNode.icon_img = iconImg;
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
                  <Flex gap="small">
                    <Button danger onClick={() => {
                      if (editNode) {
                        props.onDeleteNode(editNode);
                        props.onClose();
                      }
                    }}>
                      削除
                    </Button>
                    <Button onClick={() => {
                      if (editNode) {
                        editNode.disabled = !editNode.disabled;
                        props.onRefreshNode(editNode);
                        props.onClose();
                      }
                    }}>
                      {editNode.disabled ? '有効化' : '無効化'}
                    </Button>
                  </Flex>
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
            <Flex gap="middle" align="center">
              <div style={{ width: '80px' }}>スタイル</div>
              <Select
                style={{ flex: 1 }}
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
            </Flex>
            <Flex gap="middle" align="start">
              <div style={{ width: '80px' }}>アイコン</div>
              <Flex vertical style={{ flex: 1 }}>
                <Upload.Dragger {...uploadProps}>
                    <p className="ant-upload-drag-icon">
                        <InboxOutlined rev={undefined} />
                    </p>
                    <p className="ant-upload-text">クリックまたはドラッグで画像をアップロード</p>
                </Upload.Dragger>
                {iconImg && (
                    <img src={iconImg} alt="Node icon" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain', marginTop: '8px' }} />
                )}
              </Flex>
            </Flex>
            <Flex gap="middle" align="center">
              <div style={{ width: '80px' }}>期限</div>
              <Input
                style={{ flex: 1 }}
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Flex>
            <Flex gap="middle" align="center">
              <div style={{ width: '80px' }}>重要度</div>
              <Select
                style={{ flex: 1 }}
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
            <Flex gap="middle" align="center">
              <div style={{ width: '80px' }}>緊急度</div>
              <Select
                style={{ flex: 1 }}
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
              />
            </Flex>
          </Flex>
          </Modal>
        </>
      );
});

export default NodeEditor;
