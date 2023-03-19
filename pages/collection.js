import React from "react";

//INTERNAL IMPORT
import Style from "../styles/collection.module.css";
import images from "../img";
import {
  Banner,
  CollectionProfile,
  
} from "../collectionPage/collectionIndex";
import { Slider, Brand } from "../components/componentsindex";
import Filter from "../components/Filter/Filter";

const collection = () => {
  return (
    <div className={Style.collection}>
      <Banner bannerImage={images.creatorbackground1} />
    </div>  
  )
}

export default collection