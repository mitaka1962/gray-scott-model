class GrayScottVisualizer {
    constructor(gl, params) {
        this.gl = gl;
        this.params = params;

        this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('OES_texture_float_linear');

        const vsSource = 
        `#version 300 es
        in vec4 aVertexPosition;
        in vec2 aTexCoord;

        out vec2 vTexCoord;
        
        void main() {
            gl_Position = aVertexPosition;
            vTexCoord = aTexCoord;
        }`;

        const drawFsSource = 
        `#version 300 es
        precision highp float;
        
        in vec2 vTexCoord;

        uniform int uTarget;
        uniform vec2 uTextureSize;

        out vec4 outColor;

        uniform sampler2D uDrawTex;

        float getValue(vec2 coord) {
            return texture(uDrawTex, coord).r;
            // if (uTarget == 0) {
            //     return texture(uDrawTex, coord).r;
            // } else if (uTarget == 1) {
            //     return texture(uDrawTex, coord).g;
            // } else {
            //     return texture(uDrawTex, coord).r;
            // }
        }

        void main() {
            vec2 onePixel = 1.0 / vec2(512.0, 512.0);

            float left = getValue(vTexCoord - vec2(onePixel.x, 0.0));
            float right = getValue(vTexCoord + vec2(onePixel.x, 0.0));
            float down = getValue(vTexCoord - vec2(0.0, onePixel.y));
            float up = getValue(vTexCoord + vec2(0.0, onePixel.y));

            vec3 dx = vec3(1.0, 0.0, (right - left) / (2.0 * 0.08));
            vec3 dy = vec3(0.0, 1.0, (up - down) / (2.0 * 0.08));
            vec3 normal = normalize(cross(dx, dy));

            vec3 light1 = normalize(vec3(1.0, 1.0, 1.0));
            float diffuse = max(1.2 * dot(normal, light1), 0.0);
            vec3 light2 = normalize(vec3(-0.8, -1.2, 0.4));
            diffuse += max(0.4 * dot(normal, light2), 0.0);
            diffuse = clamp(diffuse, 0.0, 1.0);
            vec3 color = mix(vec3(0.667, 0.502, 0.361), vec3(1.0, 0.88, 0.79), diffuse);
            // vec3 color = mix(vec3(0.169, 0.451, 0.588), vec3(0.467, 0.722, 0.855), diffuse);
            // vec3 color = mix(vec3(0.168, 0.447, 0.588), vec3(0.733, 0.859, 0.922), diffuse);
            // vec3 color = vec3(1.0, 0.88, 0.79) * diffuse;
            // vec3 color = vec3(1.0) * diffuse;
            
            vec3 reflect = reflect(-light1, normal);
            vec3 eye = vec3(0.0, 0.0, 1.0);
            float x = 100.0;
            color += pow(max(0.0, dot(eye, reflect)), x) * tanh(x / 50.0);
            outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
        }`;

        const updateFsSource =
        `#version 300 es
        precision highp float;

        uniform float dx;
        uniform float dt;
        uniform float Du;
        uniform float Dv;
        uniform float feed;
        uniform float kill;

        uniform int uBoundaryCondition;
        uniform vec2 uTextureSize;
        uniform sampler2D uUpdateTex;

        in vec2 vTexCoord;

        out vec2 outState;

        void main() {
            vec2 onePixel = 1.0 / uTextureSize;
            
            // calculate laplacian
            float dec_x = vTexCoord.x - onePixel.x;
            float inc_x = vTexCoord.x + onePixel.x;
            float dec_y = vTexCoord.y - onePixel.y;
            float inc_y = vTexCoord.y + onePixel.y;

            float p_dec_x = (dec_x < 0.0) ? dec_x + 1.0 : dec_x;
            float p_inc_x = (inc_x > 1.0) ? inc_x - 1.0 : inc_x;
            float p_dec_y = (dec_y < 0.0) ? dec_y + 1.0 : dec_y;
            float p_inc_y = (inc_y > 1.0) ? inc_y - 1.0 : inc_y;

            vec2 uv = texture(uUpdateTex, vTexCoord).rg;
            vec2 uv1 = texture(uUpdateTex, vec2(p_dec_x, vTexCoord.y)).rg;
            vec2 uv2 = texture(uUpdateTex, vec2(p_inc_x, vTexCoord.y)).rg;
            vec2 uv3 = texture(uUpdateTex, vec2(vTexCoord.x, p_dec_y)).rg;
            vec2 uv4 = texture(uUpdateTex, vec2(vTexCoord.x, p_inc_y)).rg;

            if (uBoundaryCondition == 1) {
                // dirichlet boundary condition
                uv1 = (dec_x < 0.0) ? vec2(1.0, 0.0) : uv1;
                uv2 = (inc_x > 1.0) ? vec2(1.0, 0.0) : uv2;
                uv3 = (dec_y < 0.0) ? vec2(1.0, 0.0) : uv3;
                uv4 = (inc_y > 1.0) ? vec2(1.0, 0.0) : uv4;
            } else if (uBoundaryCondition == 2) {
                // neumann boundary condition
                uv1 = (dec_x < 0.0) ? uv : uv1;
                uv2 = (inc_x > 1.0) ? uv : uv2;
                uv3 = (dec_y < 0.0) ? uv : uv3;
                uv4 = (inc_y > 1.0) ? uv : uv4;
            }

            vec2 lap_uv = (uv1 + uv2 + uv3 + uv4 - 4.0*uv) / (dx*dx);

            float du = Du*lap_uv.r - uv.r*uv.g*uv.g + feed*(1.0 - uv.r);
            float dv = Dv*lap_uv.g + uv.r*uv.g*uv.g - uv.g*(feed + kill);

            float u = uv.r + du*dt;
            u = (u < 0.0) ? 0.0 : u;
            u = (u > 1.0) ? 1.0 : u;
            float v = uv.g + dv*dt;
            v = (v < 0.0) ? 0.0 : v;
            v = (v > 1.0) ? 1.0 : v;

            outState = vec2(u, v);
        }`;

        this.drawShaderProgram = this._initShaderProgram(vsSource, drawFsSource);
        this.updateShaderProgram = this._initShaderProgram(vsSource, updateFsSource);
        this.drawProgramLocations = {
            'attribute': {
                'aVertexPosition': this.gl.getAttribLocation(this.drawShaderProgram, "aVertexPosition"),
                'aTexCoord': this.gl.getAttribLocation(this.drawShaderProgram, "aTexCoord"),
            },
            'uniform': {
                'uDrawTex': this.gl.getUniformLocation(this.drawShaderProgram, "uDrawTex"),
            }
        }
        this.updateProgramLocations = {
            'attribute': {
                'aVertexPosition': this.gl.getAttribLocation(this.updateShaderProgram, "aVertexPosition"),
                'aTexCoord': this.gl.getAttribLocation(this.updateShaderProgram, "aTexCoord"),
            },
            'uniform': {
                'dx': this.gl.getUniformLocation(this.updateShaderProgram, "dx"),
                'dt': this.gl.getUniformLocation(this.updateShaderProgram, "dt"),
                'Du': this.gl.getUniformLocation(this.updateShaderProgram, "Du"),
                'Dv': this.gl.getUniformLocation(this.updateShaderProgram, "Dv"),
                'feed': this.gl.getUniformLocation(this.updateShaderProgram, "feed"),
                'kill': this.gl.getUniformLocation(this.updateShaderProgram, "kill"),
                'uBoundaryCondition': this.gl.getUniformLocation(this.updateShaderProgram, "uBoundaryCondition"),
                'uTextureSize': this.gl.getUniformLocation(this.updateShaderProgram, "uTextureSize"),
                'uUpdateTex': this.gl.getUniformLocation(this.updateShaderProgram, "uUpdateTex"),
            }
        };        
        this.vao = this._initVertexArray();
        this.textures = new Array(2);
        for (let i = 0; i < this.textures.length; i++) {
            this.textures[i] = this._loadTexture(null);
        }
        this.framebuffer = this.gl.createFramebuffer();
    }

    draw(step=8) {
        this.gl.bindVertexArray(this.vao);

        // update
        for (let i = 0; i < step; i++) {
            this.gl.useProgram(this.updateShaderProgram);

            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
            this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0,
                                        this.gl.TEXTURE_2D, this.textures[1], 0);

            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[0]);
            this.gl.uniform1i(this.updateProgramLocations.uniform.uUpdateTex, 1);

            this._setUpdateProgramUniforms();

            this.gl.viewport(0, 0, this.params.width, this.params.height);
            this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

            // swap read and write textures
            this.textures = [this.textures[1], this.textures[0]];
        }
        
        // draw
        this.gl.useProgram(this.drawShaderProgram);

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[1]);
        this.gl.uniform1i(this.drawProgramLocations.uniform.uDrawTex, 0);

        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    setTexture(source) {
        for (let i = 0; i < this.textures.length; i++) {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[i]);
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RG32F, this.params.width, this.params.height, 0, 
                            this.gl.RG, this.gl.FLOAT, source);
        }
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    _loadShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            alert('failed to compile a shader: ' + this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    _initShaderProgram(vsSource, fsSource) {
        const vertexShader = this._loadShader(this.gl.VERTEX_SHADER ,vsSource);
        const fragmentShader = this._loadShader(this.gl.FRAGMENT_SHADER ,fsSource);

        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);

        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            alert('failed to initialize a shader program: ' + this.gl.getProgramInfoLog(shaderProgram));
            this.gl.deleteProgram(shaderProgram);
            return null;
        }
    
        return shaderProgram;
    }

    _initVertexArray() {
        const vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(vao);

        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            -1.0,  1.0, 
            -1.0, -1.0,
             1.0,  1.0,
             1.0, -1.0,
        ]), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.drawProgramLocations.attribute.aVertexPosition);
        this.gl.vertexAttribPointer(
            this.drawProgramLocations.attribute.aVertexPosition,
            2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.updateProgramLocations.attribute.aVertexPosition);
        this.gl.vertexAttribPointer(
            this.updateProgramLocations.attribute.aVertexPosition,
            2, this.gl.FLOAT, false, 0, 0);

        const texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
            0.0, 1.0,
            0.0, 0.0,
            1.0, 1.0,
            1.0, 0.0
        ]), this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.drawProgramLocations.attribute.aTexCoord);
        this.gl.vertexAttribPointer(
            this.drawProgramLocations.attribute.aTexCoord,
            2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.updateProgramLocations.attribute.aTexCoord);
        this.gl.vertexAttribPointer(
            this.updateProgramLocations.attribute.aTexCoord,
            2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindVertexArray(null);
        return vao;
    }

    _loadTexture(source) {
        const texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RG32F, this.params.width, this.params.width,
                           0, this.gl.RG, this.gl.FLOAT, source);
        
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);

        return texture;
    }

    _setUpdateProgramUniforms() {
        this.gl.uniform1f(this.updateProgramLocations.uniform.dx, this.params.dx);
        this.gl.uniform1f(this.updateProgramLocations.uniform.dt, this.params.dt);
        this.gl.uniform1f(this.updateProgramLocations.uniform.Du, this.params.Du);
        this.gl.uniform1f(this.updateProgramLocations.uniform.Dv, this.params.Dv);
        this.gl.uniform1f(this.updateProgramLocations.uniform.feed, this.params.feed);
        this.gl.uniform1f(this.updateProgramLocations.uniform.kill, this.params.kill);
        this.gl.uniform1i(this.updateProgramLocations.uniform.uBoundaryCondition, this.params.boundary_condition);
        this.gl.uniform2f(this.updateProgramLocations.uniform.uTextureSize,
                          this.params.width, this.params.height);
    }
}
