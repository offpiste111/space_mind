import React from 'react'
import ReactDOM from 'react-dom/client'
import ForceGraph3D from 'react-force-graph-3d'
import SpriteText from 'three-spritetext'
import * as d3force from 'd3-force'
import * as d3dsv from 'd3-dsv'

//import {CSS2DObject, CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer'


const { useRef, useCallback, useEffect } = React;
  
fetch('./datasets/d3-dependencies.csv')
      .then(r => r.text())
      .then(data => d3dsv.csvParse(data)) 
      .then(data => {
        let nodes: any[] = [];
        let links: any[] = [];
        data.forEach(({ size, path }:any) => {
          const levels = path.split('/'),
            level = levels.length - 1,
            module = level > 0 ? levels[1] : null,
            leaf = levels.pop(),
            parent = levels.join('/');

          const node = {
            path,
            leaf,
            module,
            size: +size || 20,
            level
          };

          nodes.push(node);

          if (parent) {
            links.push({source: parent, target: path, targetNode: node});
          }
        });




  const MindMapGraph = () => {

    const fgRef = useRef<any>();

    //z軸固定
    nodes = nodes.map((node:any) => {
        node.fz = -150;
        return node;
    })


    const handleClick = useCallback((node: { x: number; y: number; z: number; }) => {
      // Aim at node from outside it
      const distance = 20;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

      if (fgRef.current)
        fgRef.current.cameraPosition(
            { x: node.x, y: node.y, z: distance }, // new position
            node, // lookAt ({ x, y, z })
            3000  // ms transition duration
        );
    }, [fgRef]);

    //const extraRenderers = [new CSS2DRenderer()];

    const nodeThreeObject = (node:any) => {

        const MultilineText = new SpriteText(node.path, 3);
        MultilineText.color = node.color;
        MultilineText.borderWidth = 0.4;
        MultilineText.padding = 2;
        MultilineText.position.x = 0;
        MultilineText.position.y = 0;

        return MultilineText;
      };

    useEffect(() => {
        // add collision force
        fgRef.current.d3Force('collision', d3force.forceCollide((node:any) => Math.sqrt(400 / (node.level + 1))+0.1));
        //fgRef.current.dagMode="rl"; kikanai
    }, []);

    const data = {'nodes' : nodes, 'links' : links}
    console.log(nodes)


    return <ForceGraph3D
        ref={fgRef}
        graphData={data}
        dagLevelDistance={100}
        backgroundColor="#101020"
        linkColor={() => 'rgba(255,255,255,0.2)'}
        nodeRelSize={1}
        nodeId="path"
        nodeLabel="id"
        //nodeVal={node => 100 / (node.level + 1)}
        nodeAutoColorBy="module"
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1}
        d3VelocityDecay={0.3}
        onNodeClick={handleClick}
        //extraRenderers={extraRenderers}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        //dagMode="rl"
        //d3AlphaDecay={0.02}

        />;
  };

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <MindMapGraph />
    </React.StrictMode>
  )
});