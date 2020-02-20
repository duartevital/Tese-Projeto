const mapboxgl = require('mapbox-gl');
const MapboxDraw = require('@mapbox/mapbox-gl-draw');
const log = require('electron-log');
const turf = require('@turf/area');

var selection_coords;
var feature_selection_count = 0;
var drawing = false;
var features = [];
var propsArray = {};
var objects_layer = [];
var objects_list = [];

mapboxgl.accessToken = 'pk.eyJ1IjoiZHVhcnRlOTYiLCJhIjoiY2sxbmljbHp0MGF3djNtbzYwY3FrOXFldiJ9._f9pPyMDRXb1sJdMQZmKAQ';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/satellite-v9',
    center: [-9.134152829647064, 38.73655900843423],
    zoom: 12
});
var draw = new MapboxDraw();

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

        type = props.type;
        height = props.height;
        under = props.underground;
        shape = geo.type;
        coords = geo.coordinates;

        propsArray = { type: type, height: height, underground: under, shape: shape, coords: coords };
        createPropertiesTable("propsTable", propsArray);

        //Definir cor para objetos selecionados.
        /*selection_coords = features.geometry.coordinates;
        feature_selection_count++;

        var feature_color;
        switch (features.sourceLayer) {
            case 'building':
                feature_color = 'rgba(66, 100, 251, 0.9)';
                break;
            case 'landuse':
                feature_color = 'rgba(57, 241, 35, 0.9)';
                break;
            case 'road':
                feature_color = 'rgba(250, 60, 60, 0.9)';
                break;
            case 'water':
                feature_color = 'rgba(25, 22, 234, 0.9)';
                break;
        }

        map.addLayer({
            'id': ('selected_feature' + feature_selection_count),
            'type': 'fill',
            'source': {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': selection_coords
                    }
                }
            },
            'layout': {},
            'paint': {
                'fill-color': feature_color
            }
        });*/
    }

});

map.on('draw.create', handleDraw);
map.on('draw.delete', handleDraw);
map.on('draw.update', handleDraw);

map.addControl(new mapboxgl.NavigationControl());

function startAll() {
    objects_layer = [];
    objects_list = [];
    document.getElementById("objTable").innerHTML = "";
    getAllObjects();
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

function savePropsChanges(button) {
    button.style.visibility = "hidden";
    document.getElementById("editButton").style.visibility = "visible";

    var id = 0;
    var selectedCoords = features.geometry.coordinates[0];
    for (var i in objects_layer) {
        var iterCoords = objects_layer[i].geometry.coordinates[0];
        if (selectedCoords.length == iterCoords.length) {
            if (selectedCoords[0][0] == iterCoords[0][0]) {
                id = i;
            }
        }
    }
    //Guardar as alterações no objeto do array com o mesmo id:
    extractTableContents("propsTable", propsArray);
    objects_list[id] = propsArray;
}

function countFeatures() {
    var buildings_num = map.queryRenderedFeatures({ layers: ['buildings_layer'] });
    var green_num = map.queryRenderedFeatures({ layers: ['landuse_layer'] }).length;
    var roads_num = map.queryRenderedFeatures({ layers: ['roads_layer'] }).length;
    log.info("Number of buildings == " + buildings_num.length);
    log.info("Number of landuse == " + green_num);
    log.info("Number of roads == " + roads_num);
}

function addDrawTools() {
    map.addControl(draw);
    drawing = true;
}

function handleDraw() {
    var data = draw.getAll();
    //var emptyProps = { type, height, underground, shape, coords };
    //addPropertiesTable(emptyProps);
}
