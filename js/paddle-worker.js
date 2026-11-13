// PaddleOCR işçisi (WASM, işlemcide): model yükleme, görüntü hazırlama ve okuma sayfadan ayrı iş parçacığında → okurken ekran donmaz.
// vendor/paddle.js değişince ?p= elle; paddle-isci.js ?v= değerini arac/surum.mjs günceller.
import '../vendor/paddle.js?p=2';
import './paddle-isci.js?v=85';
