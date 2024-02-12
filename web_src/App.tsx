import { TextureLoader, SpriteMaterial, Sprite } from 'three'

import { useMemo, useRef, useEffect } from 'react'
import { OrbitControls, Html } from '@react-three/drei'
import { Canvas, render, useFrame, useThree, useGraph } from '@react-three/fiber'
import ThreeForceGraph from 'three-forcegraph'

// imperatively using three-forcegraph

const loader = new TextureLoader()

const nodeToThree = ({  }) => {
  const imgTexture = loader.load('./assets/battle.png')
  const material = new SpriteMaterial({ map: imgTexture })
  const sprite = new Sprite(material)
  sprite.scale.set(10, 10,10)

  return sprite
}

export default function App() {
  const { scene } = useThree()

  const graph = useMemo(() => {

    const N = 300
    const gData = {
      nodes: [...Array(N).keys()].map((i) => ({ id: i })),
      links: [...Array(N).keys()]
        .filter((id) => id)
        .map((id) => ({
          source: id,
          target: Math.round(Math.random() * (id - 1)),
        })),
    }

    return new ThreeForceGraph().graphData(gData).nodeThreeObject(nodeToThree)
  }, [])

  useEffect(() => {
    while (scene.children.length > 0) {
      scene.remove(scene.children[0])
    }

    scene.add(graph)
  }, [])

  useFrame(() => {
    graph.tickFrame()
  })

  return (
    <>
      <OrbitControls />
    </>
  )
}