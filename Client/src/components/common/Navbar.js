import React from "react";
import "./Navbar.css";
import { Menu, Label, Icon, Image } from "semantic-ui-react";
import axios from "axios";
import { FirebaseContext } from '../../logic/FirebaseApp';

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
  logout = () =>
  {
    this.props.firebase.auth().signOut()
      .then(() => {
        console.log("Logged out successfully.");
      })
      .catch((error) => {
        console.log("Log out failed.");
      });
  }
  getNotifCount = () =>
  {
    axios.get('api/user/' + this.props.firebase.auth().currentUser.uid)
    .then((response) =>
    {
      console.log(response);
      return response.data.notifs.length;
    })
    .catch(function (error)
    {
      console.log(error);
    })
    .finally(function ()
    {

    });
    return 0;
  }
  componentDidMount = () =>
  {
    this.timer = setInterval(() =>
    {
      this.state = 
      {
        notifCount: this.getNotifCount(),
      }
    }, 10000)
  }
  componentWillUnmount = () =>
  {
      clearInterval(this.timer);
  }
  render() 
  {
    return (
      <div className="component-navbar">
        <Menu inverted>
          <Menu.Item as='a'>
            <Image avatar spaced='right' src={this.props.firebase.auth().currentUser.photoURL} />
            {this.props.firebase.auth().currentUser.displayName}
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
          {this.props.firebase.auth().currentUser === null ? (
            <Menu.Item onClick={() => this.props.history.push('/signin')}>
            <Icon name="user outline" />
            Sign In
            </Menu.Item>
          ) : (
            <Menu.Item onClick={this.logout}>
            <Icon name="user outline" />
            Log Out
            </Menu.Item>
          )}

        </Menu>
      </div>
    );
  }
}

export default Navbar;