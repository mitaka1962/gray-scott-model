$(function() {
    let request_id = null;
    const presets = [
        { feed: 0.022, kill: 0.051 },   // stripe                                  
        { feed: 0.035, kill: 0.065 },   // spots
        { feed: 0.012, kill: 0.050 },   // wandering bubbles
        { feed: 0.025, kill: 0.050 },   // waves
        { feed: 0.040, kill: 0.060 },   // amorphous
        { feed: 0.028, kill: 0.054 },   // bumps
        { feed: 0.025, kill: 0.060 },   // waving spots
        { feed: 0.030, kill: 0.060 },   // snapping strings
        { feed: 0.011, kill: 0.046 }    // balloons
    ];
    const default_preset = 0;
    const params = {
        'width': 512,
        'height': 512,
        'dx': 0.01,
        'dt': 1,
        'Du': 2e-5,
        'Dv': 1e-5,
        'feed': presets[default_preset].feed,
        'kill': presets[default_preset].kill,
        'boundary_condition': 0,    // 0: periodic, 1: dirichlet, 2: neumann
    };

    const gl = document.getElementById('canvas').getContext('webgl2');
    if (!gl) {
        alert('Unable to initialize WebGL2. Make sure your browser or machine supports it.');
        return;
    }
    const visualizer = new GrayScottVisualizer(gl, params);

    // initialize u, v
    const createInitTexture = function() {
        const SQUARE_SIZE = 40;
        const x_start = Math.floor(params.width / 2) - Math.floor(SQUARE_SIZE / 2);
        const y_start = Math.floor(params.height / 2) - Math.floor(SQUARE_SIZE / 2);
        const x_end = x_start + SQUARE_SIZE;
        const y_end = y_start + SQUARE_SIZE;
    
        let uvTexture = [];
        for (let i = 0; i < params.height; i++) {
            for (let j = 0; j < params.width; j++) {
                let u, v;
                if ((i >= y_start) && (i < y_end) && (j >= x_start) && (j < x_end)) {
                    u = 0.5 + Math.random() * 0.1;
                    v = 0.25 + Math.random() * 0.1;
                } else {
                    u = 1.0;
                    v = 0.0;
                }
                uvTexture.push(u, v);
            }
        }
    
        return new Float32Array(uvTexture);
    }

    const render = function() {
        visualizer.draw();
        request_id = requestAnimationFrame(render);
    }

    const initUI = function() {
        $('#init_btn').button().click(function () {
            if (request_id === null) {
                $('#ctrl_btn').text('Pause');
            } else {
                cancelAnimationFrame(request_id);
                request_id = null;
            }
            visualizer.setTexture(createInitTexture());
            request_id = requestAnimationFrame(render);
        });
        $('#init_btn').text('Init');

        $('#ctrl_btn').button().click(function () {
            if (request_id === null) {
                request_id = requestAnimationFrame(render);
                $('#ctrl_btn').text('Pause');
            } else {
                cancelAnimationFrame(request_id);
                request_id = null;
                $('#ctrl_btn').text('Play');
            }
        });
        $('#ctrl_btn').text('Pause');

        $('#preset_select').change(function (event) {
            $('#feed_slider').slider('value', presets[event.target.value].feed);
            $('#kill_slider').slider('value', presets[event.target.value].kill);
        });
        $('#preset_select').val(default_preset);

        $('#feed_slider').slider({
            value: params.feed, min: 0.000, max: 0.050, step: 0.001,
            change: function (event, ui) {params.feed = ui.value;
                                          $('#feed_span').text(params.feed.toFixed(3));},
            slide: function (event, ui) {params.feed = ui.value;
                                         $('#feed_span').text(params.feed.toFixed(3));}
        });
        $('#feed_slider').slider('value', params.feed);

        $('#kill_slider').slider({
            value: params.kill, min: 0.040, max: 0.075, step: 0.001,
            change: function (event, ui) {params.kill = ui.value;
                                          $('#kill_span').text(params.kill.toFixed(3));},
            slide: function (event, ui) {params.kill = ui.value;
                                         $('#kill_span').text(params.kill.toFixed(3));}
        });
        $('#kill_slider').slider('value', params.kill);
        $('input[name="condition"]').change(function (event) {
            params.boundary_condition = event.target.value;
        });
        $('input[name="condition"][value=' + params.boundary_condition +']').prop('checked', true);
    }

    initUI();
    visualizer.setTexture(createInitTexture())
    request_id = requestAnimationFrame(render);
});
