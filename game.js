
document.addEventListener("DOMContentLoaded", function () {
  const game = new Game();
});
class Game{
  constructor(){
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000); //75 is viewing width, then aspect ratio, nearest you can render is 0.1 from camera, furthest away is 1000 
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight); //canvas dimensions
    document.body.appendChild(this.renderer.domElement); //create the canvas

    const geometry = new THREE.BoxGeometry(1,1,1); //w, h, depth
    const light = new THREE.DirectionalLight(0xffffff); // white color
    light.position.set(0, 20, 10); // x y z positions
    const ambient = new THREE.AmbientLight(0x707070); //greyish white color

    const material = new THREE.MeshPhongMaterial({color: 0x00aaff}); //blue

    this.cube = new THREE.Mesh(geometry, material); //make a cube (a mesh)

    this.scene.add(this.cube);
    this.scene.add(light);
    this.scene.add(ambient);

    this.camera.position.z = 3; // camera is 3 away from center of scene

    this.animate();
  }

  animate(){
    const game = this;
    requestAnimationFrame(function(){ game.animate(); });

    this.cube.rotation.x += 0.01;
    this.cube.rotation.y += 0.01;

    this.renderer.render(this.scene, this.camera)
  }
}