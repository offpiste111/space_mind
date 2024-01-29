import React from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as d3dsv from 'd3-dsv'

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'


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

    const z_layer = -150

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
      const distance = 0;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

      if (fgRef.current)
        fgRef.current.cameraPosition(
            { x: node.x, y: node.y, z: distance }, // new position
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
        );
    }, [fgRef]);

    const extraRenderers = [new CSS2DRenderer()];
    
    const handleBackgroundClick = useCallback((event:any) => {

        let camera = fgRef.current.camera;
        
        //const x = event.layerX > (window.innerWidth/2) ? event.layerX - (window.innerWidth/2) :  (window.innerWidth/2) - event.layerX 
        //const y = event.layerY > (window.innerHeight/2) ? event.layerY - (window.innerHeight/2) :  (window.innerHeight/2) - event.layerY 

        //const xy_distance = Math.sqrt(x**2 + y**2)
        //const xyz_distance = Math.sqrt((z_layer + 20)**2 + xy_distance**2)

        //console.log(xyz_distance)

        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, (z_layer + 20) );
        console.log(event.layerX)
        console.log(event.layerY)
        
        console.log(window.innerWidth)
        console.log(window.innerHeight)

        let nodeId = Math.max(...nodes.map((item:any) => item.id)) + 1;
        let groupId = 1
        if(nodes.length > 0){
            groupId = Math.max(...nodes.map((item:any) => item.group)) + 1
        }
        
        nodes.push({ id: nodeId, name: "new", group: groupId, fx: coords.x, fy: coords.y, fz: z_layer }); // fx: coords.x, fy: coords.y
        //this.updateGraphData();
        //fgRef.current.graphData={ nodes: nodes, links: links };
        fgRef.current.refresh();

    }, [fgRef]);
       
    const nodeThreeObject = (node: any) => {
        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        //nodeEl.style.color = node.color;
        nodeEl.className = 'node-label2';
        return new CSS2DObject(nodeEl);

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
        fgRef.current.d3Force('collision', d3force.forceCollide((node:any) => 1));
        //(node:any) => Math.sqrt(400 / (node.level + 1))+5)
        //fgRef.current.dagMode="rl"; kikanai
    }, []);

    const data = {'nodes' : nodes, 'links' : links}
    console.log(nodes)


    return (
    <><ForceGraph3D
          ref={fgRef}
          graphData={data}
          dagLevelDistance={10}
          backgroundColor="#101020"
          linkColor={() => 'rgba(255,255,255,0.2)'}
          nodeRelSize={300}
          nodeOpacity={0.1}
          nodeId="id"
          nodeLabel={label_key}
          nodeAutoColorBy="group"
          //nodeVal={node => 100 / (node.level + 1)}
          linkDirectionalParticles={2}
          linkDirectionalParticleWidth={1}
          d3VelocityDecay={0.3}
          onNodeClick={handleClick}
          onBackgroundRightClick={onOpen}
          //extraRenderers={extraRenderers}
          //dagMode="radialin"
          //d3AlphaDecay={0.02}
          nodeThreeObject={nodeThreeObjectSt}
          nodeThreeObjectExtend={false}
          onBackgroundClick={handleBackgroundClick}
          onNodeDragEnd={node => {
            node.fx = node.x;
            node.fy = node.y;
            //node.fz = node.z;
          }} />

            <Modal
                initialFocusRef={initialRef}
                finalFocusRef={finalRef}
                isOpen={isOpen}
                onClose={onClose}
            >
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
                    <Button colorScheme='blue' mr={3} onClick={onClose}>
                    Save
                    </Button>
                    <Button onClick={onClose}>Cancel</Button>
                </ModalFooter>
                </ModalContent>
            </Modal>
          </>
        );

  };

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <ChakraProvider>
    <React.StrictMode>
      <MindMapGraph />
    </React.StrictMode>
    </ChakraProvider>
  );
});