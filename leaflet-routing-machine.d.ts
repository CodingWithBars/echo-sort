// leaflet-routing-machine.d.ts
import * as L from 'leaflet';

declare module 'leaflet' {
  namespace Routing {
    function control(options: any): any;
    function osrmv1(options: any): any;
  }
}

declare module 'leaflet-routing-machine';

declare module 'leaflet-rotate';

declare module 'react-leaflet' {
  interface MapContainerProps {
    rotate?: boolean;
    bearing?: number;
    touchRotate?: boolean;
    bearingControl?: boolean;
  }
}