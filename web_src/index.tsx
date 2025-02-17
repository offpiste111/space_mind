import React, {Suspense, useState,useEffect, useCallback,useRef} from 'react'
import ReactDOM from 'react-dom/client'

/** @jsxImportSource @emotion/react */
import { css } from "@emotion/react";


import { Input , Button, Popover, message} from 'antd';  

import MindMapGraph from './MindMapGraph'
import NodeEditor from './NodeEditor'
import LinkEditor from './LinkEditor'
import TreeDrawer from './TreeDrawer'
import { FloatButton } from 'antd';

declare const window: any;
export const eel = window.eel
eel.set_host( 'ws://localhost:5169' )

// Expose the `sayHelloJS` function to Python as `say_hello_js`
function sayHelloJS( x: any ) {
  console.log( 'Hello from ' + x )
}
// WARN: must use window.eel to keep parse-able eel.expose{...}
window.eel.expose( sayHelloJS, 'say_hello_js' )

const App = () => {
    const [x, setX] = useState(0)
    const [y, setY] = useState(0);
    const [currentFileName, setCurrentFileName] = useState<string>('');

    const handleFileSelect = async () => {
        try {
            const node_data = await eel.select_file_dialog()();
            if (node_data) {
                node_data.nodes = node_data.nodes.map((node: any) => {
                    node['fx'] = node['x']
                    node['fy'] = node['y']
                    node['fz'] = node['z']
                    delete node['vx']; 
                    delete node['vy']; 
                    delete node['vz']; 
                    return node;
                });
                if (mindMapGraphRef.current) {
                    mindMapGraphRef.current.setGraphData(node_data);
                }
            }
        } catch (error) {
            console.error('Error loading file:', error);
            message.error('ファイルの読み込みに失敗しました');
        }
    };

    // 初期データの読み込み
    useEffect(() => {
        if (mindMapGraphRef.current) {
            mindMapGraphRef.current.setGraphData({nodes:[],links:[]});
        }
    }, []);

    interface MindMapGraphRef {
        getGraphData: () => void;
        setGraphData: (data: any) => void;
        refreshNode: (node: any) => void;
        deleteNode: (node: any) => void;
        refreshLink: (link: any) => void;
        deleteLink: (link: any) => void;
        searchNodes: (text: string) => any[];
        selectNode: (node: any) => void;
    }

    interface ModalRef {
        showModal: (data: any) => void;
    }

    interface TreeDrawerRef {
        showDrawer: () => void;
    }

    const mindMapGraphRef = useRef<MindMapGraphRef>(null)
    const nodeEditorRef = useRef<ModalRef>(null)
    const linkAddModalRef = useRef<ModalRef>(null)
    const treeDrawerRef = useRef<TreeDrawerRef>(null)


  
    const handleNodeEdit = (node:any) => {

        if(nodeEditorRef.current){
            nodeEditorRef.current.showModal(node);
        }
        //setIsNodeEditorOpen(true);

        /*
        if (document.getElementById("add_popup") !== null)
        {
            document.getElementById("add_popup")?.click();
        }
        */

    }

    const handleLinkEdit = (link:any) => {
        if(linkAddModalRef.current){
            linkAddModalRef.current.showModal(link);
        }
    }

    const handleRefreshLink = (link:any) => {
        if(mindMapGraphRef.current){
            mindMapGraphRef.current.refreshLink(link);
        }
    }

    const handleDeleteLink = (link:any) => {
        if(mindMapGraphRef.current){
            mindMapGraphRef.current.deleteLink(link);
        }
    }

    const handleRefreshNode = (node:any) => {
        sayHelloJS( 'Javascript World!' )
        eel.say_hello_py( 'Javascript World!' )
        eel.generate_image(node)((generatedImage: any) => {
            node.img = generatedImage;
            if(mindMapGraphRef.current){
                mindMapGraphRef.current.refreshNode(node);
            }
        })
       
        //setEditNode(contents);
    }
    const handleDeleteNode = (node:any) => {
        if (mindMapGraphRef.current) {
            mindMapGraphRef.current.deleteNode(node);
        }
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

    const handleSave = useCallback(async () => {
        if(mindMapGraphRef.current){
            let data = mindMapGraphRef.current.getGraphData();
            try {
                const success = await eel.save_data(data)();
                if (success) {
                    message.success({
                        content: '保存しました',
                        duration: 3,
                    });
                } else {
                    message.error('保存に失敗しました');
                }
            } catch (error) {
                console.error('Error saving file:', error);
                message.error('保存に失敗しました');
            }
        }
    }, []);

    const handleSearch = useCallback((text: string) => {
        if (!mindMapGraphRef.current || !text) return [];
        return mindMapGraphRef.current.searchNodes(text);
    }, []);

    const handleNodeSelect = useCallback((node: any) => {
        if (!mindMapGraphRef.current) return;
        mindMapGraphRef.current.selectNode(node);
    }, []);

    const keyFunction = useCallback((event:any) => {
        if(event.ctrlKey) {
            if(event.code === "KeyS"){
                event.preventDefault();
                handleSave();
            }
            else if(event.code === "KeyC"){

            }
            else if(event.code === "KeyZ"){

            }
        }
      }, [handleSave]);
    
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
            onNodeEdit={handleNodeEdit}
            onLinkEdit={handleLinkEdit} />

        <Popover content={content} title="Node Edit" trigger="click" >
            <Button id="add_popup" css={setCss(x,y)}></Button>
        </Popover>

        <NodeEditor
            ref={nodeEditorRef}
            onRefreshNode={handleRefreshNode}
            onDeleteNode={handleDeleteNode} />

        <LinkEditor
            ref={linkAddModalRef}
            onRefreshLink={handleRefreshLink}
            onDeleteLink={handleDeleteLink} />

        <TreeDrawer
            ref={treeDrawerRef}
            onSave={handleSave}
            onSearch={handleSearch}
            onNodeSelect={handleNodeSelect}
            onFileSelect={handleFileSelect}
            currentFileName={currentFileName}/>

        <FloatButton onClick={() => showDrawer()} />

        </>
    );

}



ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>

    <App/>

  </React.StrictMode>,
);
