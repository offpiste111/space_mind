import React, {Suspense, useState,useEffect, useCallback,useRef} from 'react'
import ReactDOM from 'react-dom/client'

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";


import { Input , Button, Popover} from 'antd';  

import MindMapGraph from './MindMapGraph'
import NodeAddModal from './NodeAddModal'
import TreeDrawer from './TreeDrawer'
import { FloatButton } from 'antd';


const App = () => {

    

    const [x, setX] = useState(0)
    const [y, setY] = useState(0);

    const mindMapGraphRef = useRef(null)
    const nodeAddModalRef = useRef(null)
    const treeDrawerRef = useRef(null)


  
    const handleNodeEdit = (node:any) => {

        if(nodeAddModalRef.current){
            nodeAddModalRef.current.showModal(node);
        }
        //setIsNodeAddModalOpen(true);

        /*
        if (document.getElementById("add_popup") !== null)
        {
            document.getElementById("add_popup")?.click();
        }
        */

    }

    const handleRefreshNode = (node:any) => {
        console.log(node.name);
        if(mindMapGraphRef.current){
            mindMapGraphRef.current.refreshNode(node);
        }
        //setEditNode(contents);
    }

    const handleHover = (node_x:number, node_y:number) => {
        

        //setX(node_x);
        //setY(node_y);

    }

    const showDrawer = () => {
        if (treeDrawerRef.current){
            treeDrawerRef.current.showDrawer();
        }

    }

    const keyFunction = useCallback((event:any) => {

        if(event.ctrlKey) {
            if(event.code === "KeyC"){

            }
            else if(event.code === "KeyZ"){

            }

          }

        
      }, []);
    
      useEffect(() => {
        document.addEventListener("keydown", keyFunction, false);
      }, []);



    const setCss = (x:number,y:number) =>(
        css`
          position: absolute;
          opacity: 0;
          top: ${y}px;
          left: ${x}px;
        `
      );

    const content = (
        <div>
          <Input placeholder="Contents" />

        </div>
      );

    return (
        <>
        <MindMapGraph 
            ref={mindMapGraphRef}
            onHover={handleHover}
            onNodeEdit={handleNodeEdit} />

        <Popover content={content} title="Node Edit" trigger="click" >
            <Button id="add_popup" css={setCss(x,y)}></Button>
        </Popover>

        <NodeAddModal
            ref={nodeAddModalRef}
            onRefreshNode={handleRefreshNode}/>

        <TreeDrawer
            ref={treeDrawerRef}/>

        <FloatButton onClick={() => showDrawer()} />

        </>
    );

}



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>

    <App/>

  </React.StrictMode>,
);