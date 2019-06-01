import React from "react";
import "./404.css";
import { Link } from 'react-router-dom';
import { Image } from 'semantic-ui-react';
import img404 from '../../../public/images/common/404.png';

class Page404 extends React.Component 
{
  constructor(props) 
  {
    super(props);
  }
  render() 
  {
    return (
      <div className="center-screen">
      <Image src={img404} size='small' />
      <h1>404.</h1>
      <h3>We couldn't find what you were looking for. <Link to="/">Back to home.</Link></h3>
      </div>
    );
  }
}

export default Page404;