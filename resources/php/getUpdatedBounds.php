<?php

    /* Open Cage country boundaries can sometimes be large, as they include other territories belonging to the country.
    If thoses territories are on the opposite side of the world to the main territory, the bounds can span
    most of the globe. This means the 'fitBounds' map zoom does not work correctly, and the POI markers are also
    misplaced, as the Here POI API uses the bounds to identify POIs local to the country.
    Also, the bounds are sometimes completely missing from the Open Cage country result.
    Therefore the below corrects country boundaries on a case-by-case basis, for those countries found to hold
    inaccurate bounds data. These bounds are passed back in to the main Open Cage result object,
    ensuring the correct data is used in subsequent code and API calls. */

    function getIso2Bounds($countryCode)
    {
        switch ($countryCode) {
            // Fiji
            case 'FJ':
                $updatedBounds = '176.80078,-18.41363,179.98242,-16.02749';
                break;
            // France
            case 'FR':
                $updatedBounds = '-4.98340,42.30007,8.27930,51.10257';
                break;
            // Guyana
            case 'GY':
                $updatedBounds = '-61.49304,1.07660,-56.46533,8.50862';
                break;
            // Netherlands
            case 'NL':
                $updatedBounds = '2.75830,50.71683,8.50928,53.84100';
                break;
            // New Zealand
            case 'NZ':
                $updatedBounds = '164.83300,-47.71272,179.34961,-33.61314';
                break;
            // Norway
            case 'NO':
                $updatedBounds = '4.25391,57.86346,31.37695,71.32332';
                break;
            // Portugal
            case 'PT':
                $updatedBounds = '-31.5575303,29.8288021,-6.1891593,42.1543112';
                break;
            // Palestine
            case 'PS':
                $updatedBounds = '34.0689732,31.2201289,35.5739235,32.5521479';
                break;
            // Russia
            case 'RU':
                $updatedBounds = '19.6389,41.1850968,180,82.0586232';
                break;
            // United States
            case 'US':
                $updatedBounds = '-125.0011,24.9493,-66.9326,49.5904';
                break;
            // Western Sahara
            case 'EH':
                $updatedBounds = '-17.56055,20.31166,-7.76953,28.45131';
                break;
            default:
                $updatedBounds = '';
        }

        return $updatedBounds;
    }

?>