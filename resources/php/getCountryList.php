<?php

    $executionStartTime = microtime(true);

    /* ================================================ */
    /* GET COUNTRY LIST */
    /* ================================================ */
    /* Fetches, sorts and returns an array of all */
    /* countries and associated ISO2 and ISO3 codes */
    /* ================================================ */

    $countryData = json_decode(file_get_contents('../../vendors/json/countryBorders.geo.json'), true);
    $country = [];

    foreach ($countryData['features'] as $feature) {
        $temp = null;
        $temp['name'] = $feature["properties"]["name"];
        $temp['iso2'] = $feature["properties"]["iso_a2"];
        $temp['iso3'] = $feature["properties"]["iso_a3"];

        array_push($country, $temp);  
    }

    /* Sort the array of countries by country name */
    usort($country, function ($item1, $item2) {
        return $item1['name'] <=> $item2['name'];
    });

    $output['status']['code'] = "200";
    $output['status']['result'] = "OK";
    $output['status']['description'] = "success";
    $output['status']['executedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
    $output['data'] = $country;

    header('Content-Type: application/json; charset=UTF-8');

    echo json_encode($output);

?>