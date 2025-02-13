import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Modal, Input} from 'antd';  
import _ from 'lodash';

const NodeAddModal: React.FC = forwardRef((props:any, ref:any) => {
    const [isNodeAddModalOpen, setIsNodeAddModalOpen] = useState(false);
    const [contents, setContents] = useState("");
    interface Node {
        name: string;
        isNew?: boolean;
    }
    
    const [editNode, setEditNode] = useState<Node | null>(null);

       
    useImperativeHandle(ref, () => ({
        showModal: (node:any) => {
            setContents(node.name);
            setIsNodeAddModalOpen(true);

            setEditNode(node);
        }
    }));

    const handleOk = () => {
        setIsNodeAddModalOpen(false);
        //write
        if (editNode){
            editNode.name = contents
            //other
        }
        if (editNode && _.has(editNode, 'isNew') && editNode.isNew){
            editNode.isNew = false;
        }

        props.onRefreshNode(editNode);
    };
  
    const handleCancel = () => {
        setIsNodeAddModalOpen(false);
        if (editNode && _.has(editNode, 'isNew') && editNode.isNew){
            props.onDeleteNode(editNode);
        }
        
    };


    return (
        <>
          <Modal title="Edit Node" open={isNodeAddModalOpen} onOk={handleOk} onCancel={handleCancel}>
          <Input placeholder="Contents" value={contents} onChange={(e)=>setContents(e.target.value)}/>
         
          </Modal>
        </>
      );
   });
    
   export default NodeAddModal;