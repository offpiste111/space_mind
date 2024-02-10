import React, { Suspense } from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
//import App2 from './App2'

import { Canvas } from '@react-three/fiber'
import { Html, Loader } from '@react-three/drei'

const Container = (props:any) => <div className="container" {...props} />

ReactDOM.render(
  <React.StrictMode>
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
          <App />
        </Suspense>
      </Canvas>
    </Container>
  </React.StrictMode>,
  document.getElementById('root'),
)
