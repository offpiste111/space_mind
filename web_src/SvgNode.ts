import {
    Mesh,
    Group,
    Color,
    MeshBasicMaterial,
    ShapeGeometry,
    Sprite,
    SpriteMaterial,
    DoubleSide
  } from 'three'
  import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader'
  
  const loader = new SVGLoader()
  
  /**
   * @param {string} url Path to SVG file
   * @param {string} c Color
   */
  const SvgNode = (url:string) => {
    const group = new Group()
  
    loader.load(url, (data:any) => {
  
      const paths = data.paths
  
      for (let i = 0; i < paths.length; i++) {
  
        const path = paths[i]
        const fillColor = path.userData.style.fill
        if (fillColor !== undefined && fillColor !== 'none') {
  
          const material = new MeshBasicMaterial({ // Change this to SpriteMaterial, and
            color: new Color().setStyle(fillColor).convertSRGBToLinear(),
            side: DoubleSide
          })
  
          const shapes = SVGLoader.createShapes(path)
  
          for (let j = 0; j < shapes.length; j++) {
            const shape = shapes[j]
            const geometry = new ShapeGeometry(shape)
            const mesh = new Mesh(geometry, material) // change this to Sprite, the group is no longer visible
            group.add(mesh)
          }
  
        }
      }
  
    })
  
    return group
  }
  
  export default SvgNode