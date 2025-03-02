import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Modal, Input, Button, Flex, Typography } from 'antd';  
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
}

const LinkEditor = forwardRef<ModalRef, LinkEditorProps>((props, ref) => {
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
            setEditLink(link);
        }
    }));

    const handleOk = () => {
        props.onClose();
        if (editLink) {
            // 元のリンクをディープコピーして、そのコピーに変更を適用する
            const linkToUpdate = _.cloneDeep(editLink);
            linkToUpdate.name = contents;
            props.onRefreshLink(linkToUpdate);
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
            <Input 
              placeholder="Link Name" 
              value={contents} 
              onChange={(e)=>setContents(e.target.value)}
              onPressEnter={handleOk}
            />
            {editLink && (
              <Flex justify="space-between" align="center" style={{ marginTop: '16px', width: '100%' }}>
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
