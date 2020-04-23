const pip = require('@turf/boolean-point-in-polygon');
const pol = require('@turf/boolean-point-on-line');
const turf = require('@turf/helpers');
const line_intersect = require('@turf/line-intersect');
const ptld = require('@turf/point-to-line-distance');
const line_length = require('@turf/length');


function getTypeStats(source_stats, type_stats) {
    let unique = Array.from(new Set(objects_list.map(a => a.type)))
        .map(type => {
            return objects_list.find(a => a.type === type);
        });

    var total_area = 0;
    for (var i in unique)
        type_stats.push({ source: unique[i].source, type: unique[i].type, number: 0, area: 0, percentage: 0 });

    for (var i in objects_list) {
        for (var j in type_stats) {
            if (objects_list[i].type == type_stats[j].type) {
                type_stats[j].number++;
                type_stats[j].area += objects_list[i].area;
                if (objects_list[i].source == "building")
                    source_stats.building_area += objects_list[i].area;
                else if (objects_list[i].source == "landuse")
                    source_stats.landuse_area += objects_list[i].area;

                total_area += objects_list[i].area;
                break;
            }
        }
    }

    for (var i in type_stats) {
        type_stats[i].percentage = (type_stats[i].area * 100) / total_area;
    }
}

function getVisiblePolygonPortion(coords) {
    var new_coords = [];
    var bounds = map.getBounds();
    var ne_lng = bounds._ne.lng;
    var ne_lat = bounds._ne.lat;
    var sw_lng = bounds._sw.lng;
    var sw_lat = bounds._sw.lat;
    var viewport_poly = turf.polygon([[[sw_lng, ne_lat], [sw_lng, sw_lat], [ne_lng, sw_lat], [ne_lng, ne_lat], [sw_lng, ne_lat]]]);
    var nw_ne = { id: "nw_ne", line: turf.lineString([[sw_lng, ne_lat], [ne_lng, ne_lat]]) };
    var ne_se = { id: "ne_se", line: turf.lineString([[ne_lng, ne_lat], [ne_lng, sw_lat]]) };
    var se_sw = { id: "se_sw", line: turf.lineString([[ne_lng, sw_lat], [sw_lng, sw_lat]]) };
    var sw_nw = { id: "sw_nw", line: turf.lineString([[sw_lng, sw_lat], [sw_lng, ne_lat]]) };
    var axis_lines = [nw_ne, ne_se, se_sw, sw_nw];
    var coords_poly = turf.polygon([coords]);
    var axis = {};
    for (var i = 0; i < coords.length - 1; i++) {
        var point = turf.point([coords[i][0], coords[i][1]]);
        if (pip.default(point, viewport_poly)) {
            new_coords.push(coords[i]);
        } else {
            var tmp_axis = getClosestAxis(point, axis_lines);
            if (axis.id != tmp_axis.id) {
                axis = tmp_axis;
                if (axis.id == "nw_ne") {
                    var found_points = lookInAxis(axis, coords_poly, true);
                    if (found_points.length > 0)
                        new_coords.push.apply(new_coords, found_points);
                } else if (axis.id == "ne_se") {
                    var found_points = lookInAxis(axis, coords_poly, true);
                    if (found_points.length > 0)
                        new_coords.push.apply(new_coords, found_points);
                } else if (axis.id == "se_sw") {
                    var found_points = lookInAxis(axis, coords_poly, false);
                    if (found_points.length > 0)
                        new_coords.push.apply(new_coords, found_points);
                } else if (axis.id == "sw_nw") {
                    var found_points = lookInAxis(axis, coords_poly, true);
                    if (found_points.length > 0)
                        new_coords.push.apply(new_coords, found_points);
                }
            }
        }
    }
    new_coords.push(new_coords[0]);
    var new_poly = turf.polygon([new_coords]);
    return new_poly;
}

function getVisibleRoadPortion(coords) {
    var line = turf.lineString(coords);
    var bounds = map.getBounds();
    var ne_lng = bounds._ne.lng;
    var ne_lat = bounds._ne.lat;
    var sw_lng = bounds._sw.lng;
    var sw_lat = bounds._sw.lat;
    var viewport_poly = turf.polygon([[[sw_lng, ne_lat], [sw_lng, sw_lat], [ne_lng, sw_lat], [ne_lng, ne_lat], [sw_lng, ne_lat]]]);

    var visible_len = 0;
    for (var i = 0; i < coords.length - 1; i++) {
        var current = turf.point([coords[i][0], coords[i][1]]);
        var next = turf.point([coords[i + 1][0], coords[i + 1][1]]);
        var tmp_line = turf.lineString([current, next]);
        if (pip.default(current, viewport_poly) && pip.default(next, viewport_poly)) {
            visible_len += line_length.default(tmp_line);
        } else {
            var intersection = line_intersect.default(tmp_line, viewport_poly);
            if (intersection.features.length == 1) {
                var tmp_point = intersection.features[0].geometry.coordinates;
                if (pip.default(current, viewport_poly)) {
                    tmp_line = turf.lineString([tmp_point, current]);
                } else if (pip.default(next, viewport_poly)) {
                    tmp_line = turf.lineString([tmp_point, next]);
                }
                visible_len += line_length.default(tmp_line);
            } else if (intersection.features.length == 2) {
                tmp_line = turf.lineString([intersection.features[0].coordinates, intersection.features[1].coordinates]);
                visible_len += line_length.default(tmp_line);
            }
        }
    }

    return visible_len;
}

function lookInAxis(axis, poly, inverted) {
    var intersect = line_intersect.default(axis.line, poly);
    var axis_vertex_1 = axis.line.geometry.coordinates[0];
    var axis_vertex_2 = axis.line.geometry.coordinates[1];
    var result = [];

    if (pip.default(axis_vertex_1, poly) && pip.default(axis_vertex_2, poly)) {
        result.push(axis_vertex_1); result.push(axis_vertex_2);
        return result;
    }
    if (pip.default(axis_vertex_1, poly) && !pip.default(axis_vertex_2, poly)) {
        result.push(axis_vertex_1);
        for (var i = 0; i < intersect.features.length; i++) {
            result.push(intersect.features[i].geometry.coordinates);
        }
    }
    if (!pip.default(axis_vertex_1, poly) && pip.default(axis_vertex_2, poly)) {
        for (var i = 0; i < intersect.features.length; i++) {
            result.push(intersect.features[i].geometry.coordinates);
        }
        result.push(axis_vertex_2);
    }
    if (!pip.default(axis_vertex_1, poly) && !pip.default(axis_vertex_2, poly)) {
        for (var i = 0; i < intersect.features.length; i++) {
            result.push(intersect.features[i].geometry.coordinates);
        }
        if (inverted) {
            var tmp = [];
            if (result.length > 0) {
                tmp.push(result[result.length - 1]);
                tmp.push(result[0]);
            }
            return tmp;
        } else {
            return result;
        }
    }

    return result;
}

function getClosestAxis(point, axes) {
    var closest_axis = {};
    var closest_distance = 100000000;
    for (var i = 0; i < axes.length; i++) {
        var current_axis_distance = ptld.default(point, axes[i].line);
        if (current_axis_distance < closest_distance) {
            closest_distance = current_axis_distance;
            closest_axis = axes[i];
        }
    }

    return closest_axis;
}
