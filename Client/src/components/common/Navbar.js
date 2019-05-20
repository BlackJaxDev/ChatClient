import React from "react";
import "./Navbar.css";
import { Menu, Label, Icon, Image } from "semantic-ui-react";
import axios from "axios";

class Navbar extends React.Component 
{
  constructor(props) 
  {
    super(props);

    this.state = 
    {
      notifCount: this.getNotifCount(),
    }
  }
  getNotifCount()
  {
    /*axios.get('/user/' + this.props.user.name, {
      params: {
        ID: this.props.user.id
      }
    })
    .then(function (response) 
    {
      console.log(response);
      return response.data.notifCount;
    })
    .catch(function (error)
    {
      console.log(error);
    })
    .finally(function ()
    {

    });*/
    return 0;
  }
  componentDidMount()
  {
    this.timer = setInterval(() =>
    {
      this.state = 
      {
        notifCount: this.getNotifCount(),
      }
    }, 1000)
  }
  componentWillUnmount()
  {
      clearInterval(this.timer);
  }
  render() 
  {
    return (
      <div className="component-navbar">
        <Menu inverted>
          <Menu.Item as='a'>
            <Image avatar spaced='right' src={this.props.iconUrl} />
            {this.props.username}
          </Menu.Item>
          <Menu.Item as='a'>
          {
            this.state.notifCount > 0 ? 
            <React.Fragment>
              <Icon name='mail' />
              <Label color='red' floating>
                {this.state.notifCount}
              </Label>
            </React.Fragment>
              : 
            <React.Fragment>
              <Icon name='mail outline' />
            </React.Fragment>
          }
          </Menu.Item>
          <Menu.Item as='a'>
            <Icon name='bell outline' />
          </Menu.Item>
          {this.props.authenticated === true ? (
            <Menu.Item as='a'>
            <Icon name="user outline" />
            Log Out
            </Menu.Item>
          ) : (
            <Menu.Item as='a'>
            <Icon name="user outline" />
            Sign In
          </Menu.Item>
          )}

        </Menu>
      </div>
    );
  }
}

export default Navbar;