import React from "react";
import "./Navbar.css";
import { Menu, Label, Icon, Image } from "semantic-ui-react";

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
    const sec = new Date(Date.now()).getSeconds();
    return sec;
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
        <Menu compact>
          <Menu.Item as='a'>
            <Image avatar spaced='right' src={this.props.iconUrl} />
            {this.props.username}
          </Menu.Item>
          <Menu.Item as='a'>
            <Icon name='mail' />
            <Label color='red' floating>
              {this.state.notifCount}
            </Label>
          </Menu.Item>
        </Menu>
      </div>
    );
  }
}

export default Navbar;