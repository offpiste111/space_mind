import React from 'react'
import ReactDOM from 'react-dom/client'
import { Canvas } from '@react-three/fiber'
import { Html, Loader} from '@react-three/drei'
import { Modal , Button} from 'antd';  

//const Container = (props:any) => <div className="container" {...props} />

const NodeAddModal2: React.FC = (props:any) => {
    //const [isModalOpen, setIsModalOpen] = useState(false);
    const showModal = () => {
        //console.log("show modal")
        props.setIsModalOpen(true);
      };

    const handleOk = () => {
        props.setIsModalOpen(false);
    };
  
    const handleCancel = () => {
        props.setIsModalOpen(false);
    };

    return (
        <>
          <Button type="primary" onClick={showModal}>
            Open Modal
          </Button>
          <Modal title="Basic Modal" open={props.isModalOpen} onOk={handleOk} onCancel={handleCancel}>
            <p>Some contents...</p>
            <p>Some contents...</p>
            <p>Some contents...</p>
          </Modal>
        </>
      );
   };
    
   export default NodeAddModal2;