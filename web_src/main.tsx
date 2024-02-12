import React from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as THREE from 'three'
import SVGNodeData from './SvgNodeData'
import satori from 'satori'
import { html } from "satori-html";

import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';


import { useState} from 'react'


import { Canvas } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'
import { TextureLoader, SpriteMaterial, Sprite } from 'three'
import { OrbitControls } from '@react-three/drei'
import { render, useFrame, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

import './index.css'
const Container = (props:any) => <div className="container" {...props} />


const { useRef, useCallback, useEffect } = React;

const MindMapGraph = (props:any) => {

    interface GraphData {
        nodes: object[];
        links: object[];
    }

    const [graphData, setGraphData] = useState<GraphData>({nodes:[], links:[]});
    
    const fgRef = useRef<any>();
    //const nodeAddModalRef = useRef<HTMLDivElement>(null);

    const label_key = "name";
    const z_layer = -300

    useEffect(() => {
        const fetchData = async () => {
            try {
            const response = await fetch('./datasets/output.json');
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }
            const jsonData = await response.json();

            //z軸固定
            jsonData.nodes = jsonData.nodes.map((node:any) => {
                node.fz = z_layer;

                //node['fx'] = node['x']
                //node['fy'] = node['y']

                //delete node['x'];
                //delete node['y']; 
                delete node['vx']; 
                delete node['vy']; 
                //delete node['fx']; 
                //delete node['fy']; 
                delete node['__bckgDimensions']; 
                
                return node;
            })
            
            setGraphData(jsonData);

            } catch (error) {
            console.error('Error fetching data:', error);
            }

        };

        if (graphData.nodes.length === 0 && graphData.links.length === 0)
        {
            fetchData();
        }
    
    }, []); // 第2引数に空の配列を渡すことで、初回のレンダリング時のみ実行されます。



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

    //const extraRenderers = [new CSS2DRenderer()];
    

    const handleBackgroundClick = useCallback((event:any) => {

        let camera = fgRef.current.camera();
        
        //const x = event.layerX > (window.innerWidth/2) ? event.layerX - (window.innerWidth/2) :  (window.innerWidth/2) - event.layerX 
        //const y = event.layerY > (window.innerHeight/2) ? event.layerY - (window.innerHeight/2) :  (window.innerHeight/2) - event.layerY 

        //const xy_distance = Math.sqrt(x**2 + y**2)
        //const xyz_distance = Math.sqrt((z_layer + 20)**2 + xy_distance**2)

        //console.log(xyz_distance)

        let coords = fgRef.current.screen2GraphCoords(event.layerX, event.layerY, (-z_layer + camera.position.z) );

        let nodeId = Math.max(...graphData.nodes.map((item:any) => item.id)) + 1;
        let groupId = 1
        if(graphData.nodes.length > 0){
            groupId = Math.max(...graphData.nodes.map((item:any) => item.group)) + 1
        }
        
        graphData.nodes.push({ id: nodeId, name: "new", group: groupId, fx: coords.x, fy: coords.y, fz: coords.z }); // fx: coords.x, fy: coords.y
        fgRef.current.refresh();

    }, [graphData]);
       
    const nodeThreeObject = (node: any) => {
        
        const nodeEl = document.createElement('div');
        nodeEl.textContent = node[label_key];
        //nodeEl.style.color = node.color;
        nodeEl.className = 'node-label2';
        return new CSS2DObject(nodeEl);

    };

    interface Obj3DCache {
        [key: string]: THREE.Group;
    }
    const [Obj3Ds, setObj3D] = useState<Obj3DCache>({});
    const nodeThreeObjectImage = (node: {id:number,name:string}) => {

        // useEffect自体ではasyncの関数を受け取れないので内部で関数を定義して呼び出す。
        const conv_svg = async () => {
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
        const setObj = (key:string, value:THREE.Group) => {
            setObj3D((oldObj3D) => {
            return { ...oldObj3D, [key]: value };
            });
        };

        setObj(node.id.toString(), obj3d);

        //console.log(state)

        };

        if ((node.id.toString() in Obj3Ds) === false)
        {
            conv_svg();
        }
        
        //console.log(state['obj'+String(node.id)])
        return Obj3Ds[node.id.toString()];
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

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 4, 1, 0);
        //bloomPass.strength = 4;
        //bloomPass.radius = 1;
        //bloomPass.threshold = 0;
        //fgRef.current.postProcessingComposer().addPass(bloomPass);

        // add collision force
        fgRef.current.d3Force('collision', d3force.forceCollide((node:any) => 100));
        //(node:any) => Math.sqrt(400 / (node.level + 1))+5)
        //fgRef.current.dagMode="rl"; kikanai
    }, [fgRef]);


    return (
    <>
    <ForceGraph3D
        ref={fgRef}
        graphData={{'nodes' : graphData.nodes, 'links' : graphData.links}}
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
        onNodeClick={props.showModal}
        onBackgroundRightClick={props.showModal}
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

        </>
    );
};

export default MindMapGraph;



  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        
        <MindMapGraph />

    </React.StrictMode>,
  );