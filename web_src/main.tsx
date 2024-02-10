import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as THREE from 'three'
import SVGNodeData from './SvgNodeData'
import satori from 'satori'
import { html } from "satori-html";

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'

import { Canvas } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'


import { TextureLoader, SpriteMaterial, Sprite } from 'three'

import { useMemo , useState} from 'react'
import { OrbitControls } from '@react-three/drei'
import { render, useFrame, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

import { Button, ChakraProvider, FormControl, FormLabel, Input } from '@chakra-ui/react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    useDisclosure, //utility hooks の一つ
   } from "@chakra-ui/react";
    


import './index.css'
const Container = (props:any) => <div className="container" {...props} />


const { useRef, useCallback, useEffect } = React;
  
fetch('./datasets/output.json').then(res => res.json()).then(data => {
  let nodes = data.nodes;
  let links = data.links;

  const MindMapGraph = () => {

    
    const { isOpen, onOpen, onClose } = useDisclosure()

    const initialRef = React.useRef(null)
    const finalRef = React.useRef(null)

    const fgRef = useRef<any>();

    const label_key = "name";

    const z_layer = -300

    //z軸固定
    nodes = nodes.map((node:any) => {
        node.fz = z_layer;

        delete node['x'];
        delete node['y']; 
        delete node['vx']; 
        delete node['vy']; 
        delete node['fx']; 
        delete node['fy']; 
        delete node['__bckgDimensions']; 
        
        return node;
    })


    const handleClick = useCallback((node: { x: number; y: number; z: number; }) => {
      // Aim at node from outside it
      const distance = 80;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

      if (fgRef.current)
        fgRef.current.cameraPosition(
            { x: node.x, y: node.y, z: distance }, // new position
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
        );
    }, [fgRef]);

    const extraRenderers = [new CSS2DRenderer()];
    
    const handleOpen = () => {
        onOpen();
        fgRef.current.pauseAnimation();
    };
    const handleClose = () => {
        onClose();
        fgRef.current.resumeAnimation();
    };
    const handleBackgroundClick = useCallback((event:any) => {

        let camera = fgRef.current.camera();
        
        //const x = event.layerX > (window.innerWidth/2) ? event.layerX - (window.innerWidth/2) :  (window.innerWidth/2) - event.layerX 
        //const y = event.layerY > (window.innerHeight/2) ? event.layerY - (window.innerHeight/2) :  (window.innerHeight/2) - event.layerY 

        //const xy_distance = Math.sqrt(x**2 + y**2)
        //const xyz_distance = Math.sqrt((z_layer + 20)**2 + xy_distance**2)

        //console.log(xyz_distance)

        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, (-z_layer + camera.position.z) );

        let nodeId = Math.max(...nodes.map((item:any) => item.id)) + 1;
        let groupId = 1
        if(nodes.length > 0){
            groupId = Math.max(...nodes.map((item:any) => item.group)) + 1
        }
        
        nodes.push({ id: nodeId, name: "new", group: groupId, fx: coords.x, fy: coords.y, fz: coords.z }); // fx: coords.x, fy: coords.y
        fgRef.current.refresh();

    }, [fgRef]);
       
    const nodeThreeObject = (node: any) => {
        
        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        //nodeEl.style.color = node.color;
        nodeEl.className = 'node-label2';
        return new CSS2DObject(nodeEl);

    };

    const [state, setState] = useState({});
    const nodeThreeObjectImage = (node: any) => {

        // useEffect自体ではasyncの関数を受け取れないので内部で関数を定義して呼び出す。
        const asatori = async () => {
        // fetch font information
        const endpoint = new URL('https://www.googleapis.com/webfonts/v1/webfonts');
        endpoint.searchParams.set('family', 'M PLUS 1p');
        endpoint.searchParams.set('key', 'AIzaSyBwuN1FH6Yn7tpZEGy9c1xzRqB0YldWJ44');
        const fontInfo = await fetch(endpoint).then(res => res.json());
        const fontResponse = await fetch(fontInfo.items[0].files['800']);
        const fontBuffer = await fontResponse.arrayBuffer();

        const styles = [
            "padding: 0.5em 1em; margin: 2em 0; font-weight: bold; color: #6091d3; background: #FFF; border: solid 3px #6091d3; border-radius: 10px;",
            "padding: 0.5em 1em; margin: 2em 0; color: #232323; background: #fff8e8; border-left: solid 10px #ffc06e;",
            "padding: 0.5em 1em; margin: 2em 0; color: #00BCD4; background: #e4fcff; border-top: solid 6px #1dc1d6; box-shadow: 0 3px 4px rgba(0, 0, 0, 0.32);",
            "padding: 8px 19px; margin: 2em 0; color: #2c2c2f; background: #cde4ff; border-top: solid 5px #5989cf; border-bottom: solid 5px #5989cf;",
            "padding: 0.2em 0.5em; margin: 2em 0; color: #565656; background: #ffeaea; box-shadow: 0px 0px 0px 10px #ffeaea; border: dashed 2px #ffc3c3; border-radius: 8px;",
            "padding: 0.5em 1em; margin: 1em 0; background: #f4f4f4; border-left: solid 6px #5bb7ae; box-shadow: 0px 2px 3px rgba(0, 0, 0, 0.33);"
        ];

        const markup:any = html`<div style="
                                min-height: 50px;
                                min-width: 150px;
                                ${styles[node.id%styles.length]}
                                transform: scale(1,-1);">
                                ${node.name}
                            </div>`;
        const svg = await satori(markup, {
            width: 1,
            height: 1,
            fonts: [
            {
                name: 'M PLUS 1p',
                data: fontBuffer, // ここに渡す
            },
            ],
        });
    
        const obj3d = SVGNodeData(svg);
        obj3d.scale.set(1,1,1)
        obj3d.position.set( -100, -50, 0 );

        //const clone = state.concat();
        //console.log(clone)
        //delete clone[node.id];

        //setState({...clone, [node.id]:obj3d}); // stateに反映する
        const setObj = (key:number, value:any) => {
            setState((oldState) => {
            return { ...oldState, [key]: value };
            });
        };

        setObj('obj' + String(node.id), obj3d);

        //console.log(state)

        };

        if (('obj' + String(node.id) in state) === false)
        {
            asatori();
        }
        
        //console.log(state['obj'+String(node.id)])
        return state['obj' + String(node.id)];
    }
      
   
    const nodeThreeObjectCustomMesh = (node: any) => {
    
        const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(50, 20, 1),
        new THREE.MeshLambertMaterial({
            color: 'rgba(250,250,250,0.9)',
            transparent: true,
            opacity: 0.75
        })
        );

        //const group = new THREE.Group();

        const MultilineText = new SpriteText(node[label_key], 3);
        MultilineText.color = node.color;
        MultilineText.backgroundColor = 'rgba(250,250,250,0.9)';
        MultilineText.borderColor = "#0044ff";
        MultilineText.borderWidth = 0.2;
        MultilineText.padding = 3;
        MultilineText.borderRadius = 0;
        MultilineText.position.x = 0;
        MultilineText.position.y = 0;

        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        //nodeEl.style.color = node.color;
        nodeEl.className = 'node-label2';
        
        const node_el = new CSS2DObject(nodeEl);
        //node_el.scale.set(120, 120, 120);
        node_el.position.set( 0, 0.5, 0 );

        MultilineText.add(node_el);


        return MultilineText;

    };

    const nodeThreeObjectSt = (node:any) => {

        const MultilineText = new SpriteText(node[label_key], 3);
        MultilineText.color = node.color;
        MultilineText.backgroundColor = 'rgba(250,250,250,0.9)';
        MultilineText.borderColor = "#0044ff";
        MultilineText.borderWidth = 0.2;
        MultilineText.padding = 3;
        MultilineText.borderRadius = 5;
        MultilineText.position.x = 0;
        MultilineText.position.y = 0;

        return MultilineText;
      };

    useEffect(() => {
        // add collision force
        fgRef.current.d3Force('collision', d3force.forceCollide((node:any) => 30));
        //(node:any) => Math.sqrt(400 / (node.level + 1))+5)
        //fgRef.current.dagMode="rl"; kikanai
    }, []);

    const data = {'nodes' : nodes, 'links' : links}

    return (
    <><ForceGraph3D
          ref={fgRef}
          graphData={data}
          //dagLevelDistance={10}
          backgroundColor="#202030"
          linkColor={() => 'rgba(255,255,255,0.8)'}
          //nodeOpacity={1}
          nodeId="id"
          nodeLabel={label_key}
          nodeAutoColorBy="group"
          //nodeVal={node => 100 / (node.level + 1)}
          //linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1}
          //linkDirectionalArrowLength={6}
          d3VelocityDecay={0.4}
          onNodeClick={handleClick}
          onBackgroundRightClick={handleOpen}
          //extraRenderers={extraRenderers}
          //dagMode="radialin"
          d3AlphaDecay={0.02}
          nodeThreeObject={nodeThreeObjectImage}
          nodeThreeObjectExtend={true}
          onBackgroundClick={handleBackgroundClick}
          onNodeDragEnd={(node:any) => {
            node.fx = node.x;
            node.fy = node.y;
            //node.fz = node.z;
          }} />
          <ChakraProvider>
            <Modal
                initialFocusRef={initialRef}
                finalFocusRef={finalRef}
                isOpen={isOpen}
                onClose={handleClose}>

                <ModalOverlay />
                <ModalContent>
                <ModalHeader>Create your account</ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    <FormControl>
                    <FormLabel>First name</FormLabel>
                    <Input ref={initialRef} placeholder='First name' />
                    </FormControl>

                    <FormControl mt={4}>
                    <FormLabel>Last name</FormLabel>
                    <Input placeholder='Last name' />
                    </FormControl>
                </ModalBody>

                <ModalFooter>
                    <Button colorScheme='blue' mr={3} onClick={handleClose}>
                    Save
                    </Button>
                    <Button onClick={handleClose}>Cancel</Button>
                </ModalFooter>
                </ModalContent>
            </Modal>
            </ChakraProvider>
          </>
        );
  };
 
  /*

    <Container>
      <Canvas camera={{ position: [200, 200, 200], near: 0.1, far: 60000, fov: 40 }}>
        <ambientLight />
        <pointLight position={[-10, 10, 10]} intensity={1} />
        <Suspense
          fallback={
            <Html center>
              <Loader />
            </Html>
          }>
        </Suspense>
      </Canvas>
    </Container>
    
  */
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        
    <MindMapGraph />

  </React.StrictMode>,
  );
});