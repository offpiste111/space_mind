import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Modal, Input, Button, Flex } from 'antd';  
import _ from 'lodash';

interface ModalRef {
    showModal: (data: any) => void;
}

interface LinkEditorProps {
    onRefreshLink: (link: any) => void;
    onDeleteLink: (link: any) => void;
}

const LinkEditor = forwardRef<ModalRef, LinkEditorProps>((props, ref) => {
    const [isLinkEditorOpen, setIsLinkEditorOpen] = useState(false);
    const [contents, setContents] = useState("");
    
    interface Link {
        name: string;
        source: any;
        target: any;
        index: number;
        isNew?: boolean;
    }
    
    const [editLink, setEditLink] = useState<Link | null>(null);
       
    useImperativeHandle(ref, () => ({
        showModal: (link:any) => {
            setContents(link.name);
            setIsLinkEditorOpen(true);
            setEditLink(link);
        }
    }));

    const handleOk = () => {
        setIsLinkEditorOpen(false);
        if (editLink){
            editLink.name = contents;
        }
        props.onRefreshLink(editLink);
    };
  
    const handleCancel = () => {
        setIsLinkEditorOpen(false);
    };

    return (
        <>
          <Modal 
            title="Edit Link" 
            open={isLinkEditorOpen} 
            onOk={handleOk} 
            onCancel={handleCancel}
            footer={
              <Flex justify="space-between" align="center">
                {editLink && !editLink.isNew && (
                  <Button danger onClick={() => {
                    if (editLink) {
                      props.onDeleteLink(editLink);
                      setIsLinkEditorOpen(false);
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
          <Input 
            placeholder="Link Name" 
            value={contents} 
            onChange={(e)=>setContents(e.target.value)}
            onPressEnter={handleOk}
          />
          </Modal>
        </>
    );
});
    
export default LinkEditor;
