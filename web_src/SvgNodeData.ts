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
const SVGNode = (svg : string) => {

  const group = new Group()

    const data = loader.parse(svg);

    let renderOrder = 0;

    const paths = data.paths

    for (let i = 0; i < paths.length; i++) {

      const path = paths[i]
      
      const fillColor =  path.userData !== undefined ? path.userData.style.fill : 'black'
      
      if (fillColor !== undefined && fillColor !== 'none') {

        const material = new MeshBasicMaterial({ // Change this to SpriteMaterial, and
          color: new Color().setStyle(fillColor),//.convertSRGBToLinear(),
          opacity:  path.userData !== undefined ? path.userData.style.fillOpacity: 1.0,
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
          wireframe: false
        })

        const shapes = SVGLoader.createShapes(path)

        for (let j = 0; j < shapes.length; j++) {
          const shape = shapes[j]
  
          const geometry = new ShapeGeometry(shape)
          const mesh = new Mesh(geometry, material) // change this to Sprite, the group is no longer visible
          mesh.renderOrder = renderOrder ++;
          
          group.add(mesh)
          
        }
      }

      const strokeColor = path.userData !== undefined ? path.userData.style.stroke : 'black';

      if ( strokeColor !== undefined && strokeColor !== 'none' ) {

        const material = new MeshBasicMaterial( {
          color: new Color().setStyle( strokeColor ),
          opacity: path.userData !== undefined ? path.userData.style.strokeOpacity : 'black',
          transparent: true,
          side: DoubleSide,
          depthWrite: false,
          wireframe: false
        } );

        for ( const subPath of path.subPaths ) {
          
          const geometry = SVGLoader.pointsToStroke( subPath.getPoints(), path.userData !== undefined ? path.userData.style : null );

          if ( geometry ) {

            const mesh = new Mesh( geometry, material );
            mesh.renderOrder = renderOrder ++;

            group.add( mesh );

          }

        }
      }
    }

  //})

  return group
}

export default SVGNode