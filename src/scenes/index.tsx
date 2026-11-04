import React from 'react';
import {Bars,Headline,ImageScene,List,NumberScene,Quote} from './builtins';
import {customScenes} from './custom';
import {SceneProps} from './kit';

const builtins:Record<string,React.FC<SceneProps>>={headline:Headline,number:NumberScene,list:List,bars:Bars,quote:Quote,image:ImageScene};

export const Scene:React.FC<SceneProps>=(props)=>{
 const {visual}=props;
 const [registry,name]=visual.scene==='custom'?[customScenes,visual.component]:[builtins,visual.scene];
 const Component=typeof name==='string'&&Object.prototype.hasOwnProperty.call(registry,name)?registry[name]:undefined;
 if(!Component)throw new Error(`No scene called "${visual.scene==='custom'?visual.component:visual.scene}". Register custom scenes in src/scenes/custom/index.tsx.`);
 return <Component {...props}/>;
};
