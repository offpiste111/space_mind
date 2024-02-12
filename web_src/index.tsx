import React, {Suspense, useState} from 'react'
import ReactDOM from 'react-dom/client'

import { ChakraProvider, useDisclosure } from '@chakra-ui/react'
import NodeAddModal from './NodeAddModal'

//import { Canvas } from '@react-three/fiber'
//import { Html, Loader} from '@react-three/drei'
//import { Modal , Button} from 'antd';

import MindMapGraph from './main'
//import NodeAddModal2 from './NodeAddModal2'
//import App from './App'


const Container = (props:any) => <div className="container" {...props} />

const App = () => {

    //const [isModalOpen, setIsModalOpen] = useState(false);
    const { isOpen, onOpen, onClose } = useDisclosure()


    const handleClick = () => {
        //setIsModalOpen(true);
        onOpen();
    }

    //<NodeAddModal2 
    //setIsModalOpen={setIsModalOpen}
    //isModalOpen = {isModalOpen}
    return (
        <>

        <MindMapGraph 
            showModal={handleClick} />

        <ChakraProvider>
            <NodeAddModal 
            isOpen={isOpen}
            onOpen={onOpen}
            onClose={onClose}
            />
        </ChakraProvider>
        </>
    );

}



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>


<App/>

  </React.StrictMode>,
)
  
/*
        <Container>
        <Canvas camera={{ position: [0, 0, 20], near: 0.1, far: 60000, fov: 40 }}>
            <ambientLight />
            <pointLight position={[-10, 10, 10]} intensity={1} />

            <Html center>


            <NodeAddModal
            onOpen={onOpen}
            isModalOpen = {isModalOpen}
            />
            </Html>
        </Canvas>
        </Container>
*/