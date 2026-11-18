'use strict';

// Sample the physical relief in the coordinates of the artwork. It follows a turning
// page or crest and its mip chain takes it out of the picture as the surface recedes.
const PrintedSurface=(()=>{
  const base=`uniform sampler2D uMicro;
    float nearPlate(vec2 uv) {
      vec2 original=uv*vec2(1672.,941.);
      float footprint=min(length(dFdx(original)),length(dFdy(original)));
      return 1.-smoothstep(.33,1.7,footprint);
    }`;
  const paper=base+`
    float cutRelief(vec2 uv) {
      vec2 q=mat2(.96,.28,-.28,.96)*(uv*vec2(1.77778,1.));
      vec2 cut=texture2D(uMicro,q*5.9+vec2(.13,.28)).rg-.502;
      float second=texture2D(uMicro,mat2(.81,.59,-.59,.81)*q*12.8+vec2(.62,.17)).r-.502;
      return (.61*cut.g+.28*cut.r+.18*second)*nearPlate(uv);
    }`;
  const oil=base+`
    float oilRelief(vec2 uv) {
      vec2 d=(uv-vec2(.669,.494))*vec2(1.52,1.);
      float r=length(d), a=atan(d.y,d.x)/6.2831853;
      // Even periods meet around the back of the barrel in the mirrored material.
      vec2 winding=vec2(a*12.+.52*r,r*9.+.05*sin(12.56637*a));
      float broad=texture2D(uMicro,winding).b-.502;
      float narrow=texture2D(uMicro,vec2(2.*winding.x,1.71*winding.y)+vec2(.15,.54)).b-.502;
      return (.71*broad+.29*narrow)*nearPlate(uv)*smoothstep(.025,.10,r);
    }`;
  const landscape=paper+`
    vec3 printedDawn(vec2 p,vec2 shift) {
      p+=shift*.17*smoothstep(.53,.94,p.y);
      vec2 uv=vec2(p.x,1.-p.y);
      vec3 col=texture2D(uDawn,uv).rgb;
      float distanceInk=smoothstep(.39,.79,p.y);
      return col+cutRelief(uv)*(.017+.068*distanceInk)*vec3(.96,.85,.68);
    }`;
  return {paper,oil,landscape};
})();
