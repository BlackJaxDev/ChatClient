import React from "react";
import "./Profile.css";

class Profile extends React.Component 
{  
  constructor(props) 
  {
    super(props);
  }
  componentWillMount()
  {

  }
  render() 
  {
    return (
      <div className="component-profile">
      User Profile
      </div>
    );
  }
}

export default Profile;