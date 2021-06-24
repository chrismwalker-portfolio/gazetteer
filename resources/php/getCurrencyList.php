<?php

    $executionStartTime = microtime(true);

    /* ================================================ */
    /* GET CURRENCY LIST */
    /* ================================================ */
    /* Fetches, sorts and returns an array of all */
    /* currencies available for exchange rate conversion */
    /* ================================================ */

    $url = 'https://openexchangerates.org/api/currencies.json';

	$ch = curl_init();
	curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_URL,$url);

	$result = curl_exec($ch);

	curl_close($ch);

	$currencyData = json_decode($result,true);

    $currency = [];

    foreach ($currencyData as $key => $value) {
        $temp = null;
        $temp['name'] = $value;
        $temp['code'] = $key;

        array_push($currency, $temp);  
    }

    /* Sort the array of currencies by currency name */
    usort($currency, function ($item1, $item2) {
        return $item1['name'] <=> $item2['name'];
    });

    $output['status']['code'] = "200";
    $output['status']['result'] = "OK";
    $output['status']['description'] = "success";
    $output['status']['executedIn'] = intval((microtime(true) - $executionStartTime) * 1000) . " ms";
    $output['data'] = $currency;

    header('Content-Type: application/json; charset=UTF-8');

    echo json_encode($output);

?>