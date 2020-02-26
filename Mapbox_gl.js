const mapboxgl = require('mapbox-gl');
const MapboxDraw = require('@mapbox/mapbox-gl-draw');
const log = require('electron-log');
const turf = require('@turf/area');

var selection_coords;
var feature_selection_count = 0;
var drawing = false;
var features = [];
var draw_id = 0;
var draw_object_list = [];
var objects_layer = [];
var objects_list = [];

mapboxgl.accessToken = 'pk.eyJ1IjoiZHVhcnRlOTYiLCJhIjoiY2sxbmljbHp0MGF3djNtbzYwY3FrOXFldiJ9._f9pPyMDRXb1sJdMQZmKAQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9',
    center: [-9.134152829647064, 38.73655900843423],
    zoom: 12
});
var draw = new MapboxDraw({
    drawing: true,
    displayControlsDefault: false,
    controls: {
        polygon: true,
        line_string: true,
        trash: true
    }
});

map.on('load', function () {
    map.addLayer({
        "id": "buildings_layer",
        "type": "fill",
        "minzoom": 17,
        "source": {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8',
        },
        "source-layer": "building",
        "paint": {
            "fill-color": "rgba(66,100,251, 0.4)",
            "fill-outline-color": "rgba(66,100,251, 0.5)"
        }
    });
    map.addLayer({
        "id": "water_layer",
        "type": "fill",
        "minzoom": 17,
        "source": {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8',
        },
        "source-layer": "water",
        "paint": {
            "fill-color": "rgba(25, 22, 234, 0.4)",
            "fill-outline-color": "rgba(25, 22, 234, 0.5)"
        }
    });
    map.addLayer({
        "id": "landuse_layer",
        "type": "fill",
        "minzoom": 17,
        "source": {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-streets-v8',
        },
        "class": "grass",
        "source-layer": "landuse",
        "paint": {
            "fill-color": "rgba(57, 241, 35, 0.4)",
            "fill-outline-color": "rgba(57, 241, 35, 0.5)"
        }
    });
    map.addLayer({
        "id": "traffic_layer",
        "type": "line",
        "line-offset": true,
        "minzoom": 17,
        "source": {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1',
        },
        "source-layer": "traffic",
        "paint": {
            "line-width": 3,
            "line-color": [
                "case",
                [
                    "==",
                    "low",
                    [
                        "get",
                        "congestion"
                    ]
                ],
                "#aab7ef",
                [
                    "==",
                    "moderate",
                    [
                        "get",
                        "congestion"
                    ]
                ],
                "#4264fb",
                [
                    "==",
                    "heavy",
                    [
                        "get",
                        "congestion"
                    ]
                ],
                "#ee4e8b",
                [
                    "==",
                    "severe",
                    [
                        "get",
                        "congestion"
                    ]
                ],
                "#b43b71",
                "#000000"
            ]
        }
    });
});

map.on('click', function (e) {
   if (drawing == false) {
       features = map.queryRenderedFeatures(e.point)[0];
       var props = features.properties;
       var geo = features.geometry;

       id = findObjId(props.id);
       type = objects_list[id].type;
       height = objects_list[id].height;
       under = objects_list[id].underground;
       shape = objects_list[id].shape;
       coords = objects_list[id].coords;

       var propsArray = { id: id, type: type, height: height, underground: under, shape: shape, coords: coords };
       createPropertiesTable("propsTable", propsArray);
       log.info(propsArray);
   }
});

map.on('draw.create', handleDraw);
//map.on('draw.delete', handleDraw);
map.on('draw.update', handleDraw);

map.addControl(new mapboxgl.NavigationControl());
map.addControl(draw);
toggleDrawButtons(false);

function startAll() {
    objects_layer = [];
    objects_list = [];
    document.getElementById("objTable").innerHTML = "";
    getAllObjects();
    openTab(event, 'features_tab');
}

function getAllObjects() {
    objects_layer = map.queryRenderedFeatures();

    for (var i in objects_layer) {
        type = objects_layer[i].properties.type;
        height = objects_layer[i].properties.height;
        under = objects_layer[i].properties.underground;
        shape = objects_layer[i].geometry.type;
        coords = objects_layer[i].geometry.coordinates;
        var propsArray = { id: i, type: type, height: height, underground: under, shape: shape, coords: coords };

        addObjectToTable("objTable", propsArray);
        objects_list.push(propsArray);
    }

}

function findObjId(draw_id) {
    var id = -1;
    var selectedCoords = features.geometry.coordinates[0];
    for (var i in objects_layer) {
        var iterCoords = objects_layer[i].geometry.coordinates[0];
        if (selectedCoords.length == iterCoords.length) {
            if (selectedCoords[0][0] == iterCoords[0][0]) {
                id = i;
            }
        }
    }
    if (id == -1) {
        id = selectedDrawObject(draw_id);
    }
    return id;
}

function savePropsChanges(button) {
    button.style.visibility = "hidden";
    document.getElementById("editButton").style.visibility = "visible";
    var elems = document.getElementsByClassName("cell2");
    for (var i = 0; i < elems.length; i++) {
        elems[i].setAttribute("contenteditable", "false");
    }
    toggleDrawButtons(false);

    //Guardar as alterações no objeto do array com o mesmo id:
    var propsArray = {};
    extractTableContents("propsTable", propsArray);
    objects_list[propsArray.id] = propsArray;
    var objTable = document.getElementById("objTable");
    if (drawing == true) {
        var draw_obj = { id: propsArray.id, draw_id: draw_id };
        draw_object_list.push(draw_obj);
        addObjectToTable("objTable", propsArray);
        draw_id = 0;
    } else {
        if (objTable.rows.length >= objects_list.length) {
            changeObjectInTable("objTable", propsArray);
        }
    }
    drawing = false;
}

function addDrawTools() {
    document.getElementById("propsTable").innerHTML = "";
    toggleDrawButtons(true);
    drawing = true;
}

function handleDraw() {
    var data = draw.getAll();
    log.info(data);
    var polygonCoords = data.features[data.features.length - 1].geometry.coordinates[0];
    draw_id = data.features[data.features.length - 1].id;
    var id = objects_list.length;

    var array = { id: id, type: "insert type", height: "", underground: "", shape: "", coords: polygonCoords };
    createPropertiesTable("propsTable", array);
    setPropsTableEditable(document.getElementById("editButton"));
}

function selectedDrawObject(draw_id) {
    var id = -1;
    for (var i = 0; i < draw_object_list.length; i++) {
        if (draw_object_list[i].draw_id == draw_id) {
            id = draw_object_list[i].id;
        }
    }

    return id;
}

function toggleDrawButtons(enable) {
    var draw_buttons = document.getElementsByClassName("mapbox-gl-draw_ctrl-draw-btn");
    if (enable == false) {
        draw_buttons[0].disabled = true;
        draw_buttons[1].disabled = true;
        draw_buttons[2].disabled = true;
        draw_buttons[0].classList.add("disabled-control-button");
        draw_buttons[1].classList.add("disabled-control-button");
        draw_buttons[2].classList.add("disabled-control-button");
    } else {
        draw_buttons[0].disabled = false;
        draw_buttons[1].disabled = false;
        draw_buttons[2].disabled = false;
        draw_buttons[0].classList.remove("disabled-control-button");
        draw_buttons[1].classList.remove("disabled-control-button");
        draw_buttons[2].classList.remove("disabled-control-button");
    }
}


function dumbFunction() {
    log.info("objects_list:");
    for (var i in objects_list) {
        log.info(objects_list[i]);
    }

    log.info("draw_objects_list:");
    for (var i in draw_object_list) {
        log.info(draw_object_list[i]);
    }
}