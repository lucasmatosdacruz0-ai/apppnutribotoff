import React from 'react';

export const GridIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...props },
        React.createElement('rect', { x: "3", y: "3", width: "7", height: "7" }),
        React.createElement('rect', { x: "14", y: "3", width: "7", height: "7" }),
        React.createElement('rect', { x: "14", y: "14", width: "7", height: "7" }),
        React.createElement('rect', { x: "3", y: "14", width: "7", height: "7" })
    )
);