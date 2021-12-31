// SPDX-License-Identifier: MIT

pragma solidity >=0.7.0 <0.9.0;

import "./ERC20.sol";
import "./utils/IERC20.sol";

//Interface ERC20

interface IERC20Token {
    function transfer(address, uint256) external returns (bool);
    function approve(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
    function totalSupply() external view returns (uint256);
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);

    function  _createAccount(address) external;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}


/**
 * @title Celobook
 * @author M.LECOUSTE
 * @notice - This contract allowes users to make public posts
 *      and to like posts through ERC20 token with fairly regular distribution to users
 * @dev Accounts are stored to manage fair distribution of ERC20 implementation
 *      contract is ownable to manage debug during beta period
*/

contract Celobook {
    address  payable _owner;

    string      public   _nameToken      = "CeloBookToken";
    string      public   _symbolToken    = "CBT";
    uint256     public   _maxSupplyToken = 1000000 * ( 1 * 10 ** 18);
    uint256     public   _initialSupply  = _maxSupplyToken / 4;

    uint256     public   _newUserReward  = 100 * (1 * 10 ** 18);
    uint256     public   _dailyReward    = 5 * (1 * 10 ** 18);

    ERC20     _bookTokenContract;

    uint      _newPostFee     =       10 * (1 * 10 ** 18)  ;
    uint256   _newLikeFee     =       1 * (1 * 10 ** 18) ;
    uint256   _saleFee        =       10; // sale fee %


    constructor()  {
        _owner  =   payable(msg.sender);
        _bookTokenContract = new ERC20(
            _nameToken,
            _symbolToken,
            _maxSupplyToken,
            _initialSupply,
            _newUserReward,
            _dailyReward
        );
    }
    //Manage ownability
    modifier onlyOwner() {
        require(_owner == msg.sender, "Only owner");
        _;
    }
    function _setOwner(address payable _newOwner) public onlyOwner {
        _owner = _newOwner;
    }
    function getOwner() public view returns(address) {
        return _owner;
    }
    function _setPostFee(uint newPostFee_) public onlyOwner {
        _newPostFee =      newPostFee_ ;
    }
    function _setLikeFee(uint256 newLikeFee_) public onlyOwner {
        _newLikeFee     =   newLikeFee_ ;
    }
    function _setSalefeeLevel(uint256 newSaleFee_) public onlyOwner {
        require(newSaleFee_ > 0 && newSaleFee_ < 1, "Sale fee must be in ]0;1[");
        _saleFee = newSaleFee_;
    }
    //Modify Token contract address
    function _setNewTokenContract(ERC20 _newContract) public onlyOwner {
        _bookTokenContract = _newContract;
    }

    //Getter fees
    function    getNewPostFee() public view returns(uint256) {
        return _newPostFee;
    }
    function    getNewLikeFee() public view returns(uint256) {
        return _newLikeFee;
    }
    function    getSaleFeeLevel() public view returns(uint256) {
        return _saleFee * 100;
    }

    //get ERC20 token address
    function getTokenContract() public view returns(ERC20) {
        return _bookTokenContract;
    }


    //    address internal cUsdTokenAddress = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1;

    uint256 internal nbUsers    =   1;

    struct User {
        address payable userAddress;
        string          pseudo;
        uint64          nbPosts;
    }

    mapping(address => User) users;
    mapping(address => uint64) nbLikes;
    mapping(address => uint) lastLike;

    mapping(address => uint) likeBalance;

    //Create both user account and token wallet
    function createUser(string memory _pseudo) public {
        require(!(lastLike[msg.sender] > 0), "User already stored");
        users[msg.sender] = User(
            payable(msg.sender),
            _pseudo,
            uint64(0)
        );
        ERC20(_bookTokenContract)._createAccount(msg.sender);
        likeBalance[msg.sender] = _newUserReward;
        lastLike[msg.sender] = block.timestamp - (1 days);
        nbUsers++;
    }
    //get all user data
    function readUser(address _address) public view returns(
        string memory,  //pseudo
        uint64,         //nbUserPosts
        uint64,         //nbUserLikes
        bool,           //canLikePost
        uint256        //tokenBalance
    ) {
        require(lastLike[_address] > 0, "User not found");
        return(
        users[_address].pseudo,
        users[_address].nbPosts,
        nbLikes[_address],
        lastLike[_address] + (1 days) <= block.timestamp,
        _bookTokenContract.balanceOf(_address)
        );
    }
    //User can like only one post per 24 hours
    function canLikePost(address _userAddress) public view returns(bool) {
        return lastLike[_userAddress] + (1 days) <= block.timestamp;
    }
    //get User's pseudo
    function getPseudo(address _userAddress) public view returns(string memory) {
        return users[_userAddress].pseudo;
    }

    function setPseudo(string memory _newPseudo) external onlyUser {
        require(!(keccak256(bytes(_newPseudo)) == keccak256(bytes(users[msg.sender].pseudo))), "New pseudo must be different as actual one ");
        users[msg.sender].pseudo = _newPseudo;
    }

    function getLikeBalance(address _userAddress) public view returns(uint) {
        require(lastLike[_userAddress] > 0, "No user found");
        return likeBalance[_userAddress];
    }

    modifier onlyUser()  {
        require(lastLike[msg.sender]  > 0, "Only registered user can process");
        _;
    }

    //**************************************************************************************************************************/

    //**************************************************************************************************************************/
    // Post Management
    uint256     nbPosts     =   0;

    struct Post {
        string              title;
        string              content;
    }

    event NewPost(uint postId, address owner);
    event OnSale(uint posstId, uint256 price);
    event PostSale(uint postId, address buyer, uint256 price);
    event NewLike(uint postId, address liker);

    mapping(uint256 => Post) posts;
    mapping(uint256 => address payable) postOwner;

    mapping(uint256 => uint256)  postLikes;
    mapping(uint256 => uint256)  postsOnSale; //get Post Price from postId

    function newPost(string memory _title, string memory _content) public onlyUser {
        nbPosts++;
        posts[nbPosts] = Post(_title, _content);
        postOwner[nbPosts] = payable(msg.sender);
        emit NewPost(nbPosts, msg.sender);
        users[msg.sender].nbPosts++;
    }

    function putOnSale(uint256 _postId, uint256 _price) public onlyUser {
        require(postOwner[_postId] == payable(msg.sender), "Only post owner can sell");
        require(_price > 0, "Price must be > 0");
        postsOnSale[_postId] = _price;
        emit OnSale(_postId, _price);
    }

    function buyPost(uint256 _postId) public onlyUser {
        require(postsOnSale[_postId] > 0, "Post not buyable");
        require(likeBalance[msg.sender] >= postsOnSale[_postId], "CBT balance too low");
        likeBalance[msg.sender] -= postsOnSale[_postId];
        likeBalance[postOwner[_postId]] += postsOnSale[_postId];
        users[postOwner[_postId]].nbPosts--;
        postOwner[_postId] = payable(msg.sender);
        emit PostSale(_postId, msg.sender, postsOnSale[_postId]);
        postsOnSale[_postId] = 0;
        users[msg.sender].nbPosts++;
    }

    function removeFromSale(uint256 _postId) public onlyUser {
        require(postsOnSale[_postId] > 0, "Post not found on sale post list");
        require(postOwner[_postId] == payable(msg.sender), "Only owner can remove post from Sale list");
        postsOnSale[_postId] = 0;
    }

    function likePost(uint256 _postId) public onlyUser {
        require(lastLike[msg.sender] + (1 days) <= block.timestamp, "User still can't like post at the moment");
        postLikes[_postId]++;
        nbLikes[postOwner[_postId]]++;
        likeBalance[postOwner[_postId]] += uint(1 * 10 ** 18);
        lastLike[msg.sender] = block.timestamp;
    }

    function getNbPosts() public view returns(uint) {
        return nbPosts;
    }

    function getPost(uint256 _postId) public view returns(string memory, string memory, uint, uint, address payable) {
        require(_postId <= nbPosts, "Post not found");
        return (
        posts[_postId].title,
        posts[_postId].content,
        postLikes[_postId],
        postsOnSale[_postId],
        postOwner[_postId]
        );
    }

    //****************************************************************************************/

    //Token Management private functions
    function _transferToken(address _to, uint256 _amount) private {
        ERC20(_bookTokenContract).transfer(_to, _amount);
    }
}