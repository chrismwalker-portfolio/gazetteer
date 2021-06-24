<?php

    $executionStartTime = microtime(true);

    /* ================================================== */
    /* GET COUNTRY BORDER */
    /* ================================================== */
    /* Filters the selected country ISO2 code and returns */
    /* that country's Feature from the FeatureCollection */
    /* ================================================== */

    $iso2 = $_REQUEST['iso2'];

    $countryData = json_decode(file_get_contents('../../vendors/json/countryBorders.geo.json'), true);

    /* Filter the single country Feature that matches the ISO2 code */
    $countryFeature = array_filter($countryData["features"], function ($country) use ($iso2) {
         return $country["properties"]["iso_a2"] == $iso2;
    });

    $output['status']['code'] = "200";
    $output['status']['result'] = "OK";
    $output['status']['description'] = "success";
    $output['status']['executedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
    $output['data'] = array_values($countryFeature);

    header('Content-Type: application/json; charset=UTF-8');

    echo json_encode($output);

?>