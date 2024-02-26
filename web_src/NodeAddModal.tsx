import React,{useState, forwardRef, useImperativeHandle } from 'react'
import { Modal, Input} from 'antd';  
import _ from 'lodash';

const NodeAddModal: React.FC = forwardRef((props:any, ref:any) => {
    const [isNodeAddModalOpen, setIsNodeAddModalOpen] = useState(false);
    const [contents, setContents] = useState("");
    const [editNode, setEditNode] = useState(null);

       
    useImperativeHandle(ref, () => ({
        showModal: (node:any) => {
            setContents(node.name);
            setIsNodeAddModalOpen(true);

            setEditNode(node);
        }
    }));

    const handleOk = () => {
        setIsNodeAddModalOpen(false);

        //let clone_node:any= _.cloneDeep(editNode);
        //let clone_node:any = JSON.parse(JSON.stringify(editNode))
        //clone_node.name = contents


        //write
        if (editNode){
            editNode.name = contents
        }

        props.onRefreshNode(editNode);
    };
  
    const handleCancel = () => {
        setIsNodeAddModalOpen(false);
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