class Terrain {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.geometry = new THREE.PlaneBufferGeometry(
            width,
            height,
            width - 1,
            height - 1
        );
        let rotation = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
        this.geometry.applyMatrix(rotation);
        this.array = this.geometry.attributes.position.array;
        this.mesh = null;
        this.yScale = 0.0;
    }

    static create(scene,sceneObj,yScale,dirLight,maps)
    {
        Terrain.fromImage('resources/textures/heightmaps/heightmap.png').then(function(terrain) {
            var loader = new THREE.TextureLoader();
            /*var texture = loader.load('resources/textures/terrain/grass.jpg');
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(terrain.width/50, terrain.height/50);*/
            sceneObj.content = terrain;
            sceneObj.sceneObj = terrain.build(maps,dirLight);
            scene.add(sceneObj.sceneObj);
            // Scale terrain peaks
            terrain.yScale = terrain.mesh.scale.y = yScale;
        });
    }

    static fromImage(src) {
        return new Promise(function(resolve, reject) {
            let img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;
                let canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                let ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                let pixels = ctx.getImageData(0, 0, width, height).data;
                let terrain = new Terrain(width, height);
                for (let i = 0; i < width * height; i++) {
                    terrain.array[i * 3 + 1] = pixels[i * 4] / 256;
                }
                resolve(terrain);
            };
            img.onabort = reject;
            img.onerror = reject;
            img.src = src;
        });
    }

    build(maps,dirLight) {
        var loader = new THREE.TextureLoader()
        
        var bumpData = loader.load( maps.bumpMap );
        bumpData.wrapS = bumpData.wrapT = THREE.RepeatWrapping; 

        var lowerTexture = loader.load( maps.lowerTexture );
        lowerTexture.wrapS = lowerTexture.wrapT = THREE.RepeatWrapping; 
        
        var upperTexture = loader.load( maps.upperTexture );
        upperTexture.wrapS = upperTexture.wrapT = THREE.RepeatWrapping; 
        
        this.geometry.computeBoundingSphere();
        this.geometry.computeVertexNormals();
        //this.geometry.computeFaceNormals();
        var dir = dirLight.position.clone();
        dir.sub(dirLight.target.position);

        var customUniforms = {
            bumpData:       { type: "t", value: bumpData },
            grassTexture:	{ type: "t", value: lowerTexture },
            rockyTexture:	{ type: "t", value: upperTexture },
            dirLight: {type: "vec3",value: dir}
        };

        // create custom material from the shader code above
        //   that is within specially labelled script tags
        var customMaterial = new THREE.ShaderMaterial( 
        {
            uniforms: customUniforms,
            vertexShader:   document.getElementById( 'vertexShader'   ).textContent,
            fragmentShader: document.getElementById( 'fragmentShader' ).textContent,
            // side: THREE.DoubleSide
        }   );

        
        /*this.material = new THREE.MeshLambertMaterial({
            map: texture
        });*/

        this.mesh = new THREE.Mesh(this.geometry, /*this.material*/ customMaterial);
        this.mesh.position.x = this.height/2.0;
        this.mesh.position.z = this.width/2.0;
        return this.mesh;
    }

    getHeightAt(x, z) {
        /*
        Get height (y value) of terrain at x, z
        Find which "cell" x, z is in by rounding them both down since each
        height sample is evenly spaced at integer locations.
        Once we have a cell (a location between four neighboring height samples)
        we can figure out the offset by subtracting the rounded values from the
        real values. This effectively gives us the amount "into" the cell we are
        for both x and z. 
        rx = x - floor(z)
        rz = z - floor(z)
        a----b
        |    |
        |p   |
        d----c
        Using these fractional values, if our position is marked by the p, the
        height can be found by first interpolating between (a->b) using rx, then
        interpolating between (c->d) using rx, and then between the result of
        both of those using rz.
        y = (a * (1 - rx) + b * rx) * (1 - rz) + (c * rx + d * (1 - rx)) * rz
        */
        let width = this.width;
        let height = this.height;
        if (x < 0 || x >= width || z < 0 || z >= height) {
            throw new Error('point outside of terrain boundary');
        }
        // Get integer floor of x, z
        let ix = Math.floor(x);
        let iz = Math.floor(z);
        // Get real (fractional) component of x, z
        // This is the amount of each into the cell
        let rx = x - ix;
        let rz = z - iz;
        // Edges of cell
        let a = this.array[(iz * width + ix) * 3 + 1];
        let b = this.array[(iz * width + (ix + 1)) * 3 + 1];
        let c = this.array[((iz + 1) * width + (ix + 1)) * 3 + 1];
        let d = this.array[((iz + 1) * width + ix) * 3 + 1];
        // Interpolate top edge (left and right)
        let e = (a * (1 - rx) + b * rx);
        // Interpolate bottom edge (left and right)
        let f = (c * rx + d * (1 - rx));
        // Interpolate between top and bottom
        let y = (e * (1 - rz) + f * rz);
        return y * this.yScale;
    }
}