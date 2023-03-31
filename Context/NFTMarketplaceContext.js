import React, { useState, useEffect, useContext } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import { useRouter } from "next/router";
import axios from "axios";
import { create as ipfsHttpClient } from "ipfs-http-client";

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;
const projectSecretKey = process.env.NEXT_PUBLIC_SECRECT_KEY;
const auth = `Basic ${Buffer.from(`${projectId}:${projectSecretKey}`).toString(
  "base64"
)}`;

const subdomain = process.env.NEXT_PUBLIC_SUBDOMAIN;

const client = ipfsHttpClient({
  host: "infura-ipfs.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
});

//INTERNAL  IMPORT
import {
    NFTMarketplaceAddress,
    NFTMarketplaceABI,
  } from "./constants";

//---FETCHING SMART CONTRACT
const fetchContract = (signerOrProvider) =>
  new ethers.Contract(
    NFTMarketplaceAddress,
    NFTMarketplaceABI,
    signerOrProvider
  );
  
//---CONNECTING WITH SMART CONTRACT

const connectingWithSmartContract = async () => {
    try {
        const web3Modal = new Web3Modal();
        const connection = await web3Modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();
    
        const contract = fetchContract(signer);
        return contract;
        } catch (error) {
        console.log("Something went wrong while connecting with contract", error);
    }
  };  

export const NFTMarketplaceContext = React.createContext();

export const NFTMarketplaceProvider = ({ children }) => {
    const titleData = "Discover, collect, and sell NFTs";

    //------USESTATE
    const [currentAccount, setCurrentAccount] = useState("");
    const router = useRouter();
    //---CHECK IF WALLET IS CONNECTD

  const checkIfWalletConnected = async () => {
    try {
      if (!window.ethereum)
        return 
        //setOpenError(true), 
        //setError("Install MetaMask");
        console.log("Install Metamask");

      const accounts = await window.ethereum.request({
        method: "eth_accounts",
      });

      if (accounts.length) {
        setCurrentAccount(accounts[0]);
        // console.log(accounts[0]);
      } else {
        // setError("No Account Found");
        // setOpenError(true);
        console.log("No account");
      }

      //const provider = new ethers.providers.Web3Provider(window.ethereum);
      //const getBalance = await provider.getBalance(accounts[0]);
      //const bal = ethers.utils.formatEther(getBalance);
      setAccountBalance(bal);
    } catch (error) {
       console.log("Something wrong while connecting to wallet");
      // setOpenError(true);
      console.log("not connected");
    }
  };

  useEffect(() => {
    checkIfWalletConnected();
  }, []);

      //---CONNET WALLET FUNCTION
  const connectWallet = async () => {
    try {
      if (!window.ethereum)
        return 
        //setOpenError(true), 
        //setError("Install MetaMask");
        console.log("Install Metamask");


      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      //console.log(accounts);
      setCurrentAccount(accounts[0]);

      //window.location.reload();
      //connectingWithSmartContract();
    } catch (error) {
       console.log ("Error while connecting to wallet");
      // setOpenError(true);
    }
  };
  
     //---UPLOAD TO IPFS FUNCTION
    const uploadToIPFS = async (file) => {
      try {
        const added = await client.add({ content: file });
        const url = `${subdomain}/ipfs/${added.path}`;
        return url;
      } catch (error) {
        //setError("Error Uploading to IPFS");
        //setOpenError(true);
        console.log("Error Uploading to IPFS");
    }
  };

  //---CREATENFT FUNCTION
  const createNFT = async (name, price, image, description, router) => {
    if (!name || !description || !price || !image)
      return 
      //setError("Data Is Missing"), 
      //setOpenError(true);

    const data = JSON.stringify({ name, description, image });

    try {
      const added = await client.add(data);
      const url = `${subdomain}/ipfs/${added.path}`;

      await createSale(url, price);
      router.push("/searchPage");
    } catch (error) {
      console.log ("Error while creating NFT");
      //setOpenError(true);
    }
  };

    //--- createSale FUNCTION
  const createSale = async (url, formInputPrice, isReselling, id) => {
    try {
      console.log(url, formInputPrice, isReselling, id);
      const price = ethers.utils.parseUnits(formInputPrice, "ether");

      const contract = await connectingWithSmartContract();

      const listingPrice = await contract.getListingPrice();

      const transaction = !isReselling
        ? await contract.createToken(url, price, {
            value: listingPrice.toString(),
          })
        : await contract.resellToken(id, price, {
            value: listingPrice.toString(),
          });

      await transaction.wait();
      router.push('/searchPage');
      console.log(transaction);
    } catch (error) {
      //setError("error while creating sale");
      //setOpenError(true);
      console.log("error while creating sale");
    }
  };

    //--FETCHNFTS FUNCTION

  const fetchNFTs = async () => {
    try {
      // const provider = new ethers.providers.JsonRpcProvider(
      //   //--process.env.NEXT_PUBLIC_POLYGON_MUMBAI_RPC
      //   //"https://polygon-mumbai.g.alchemy.com/v2/0awa485pp03Dww2fTjrSCg7yHlZECw-K"
      // );
      const web3Modal = new Web3Modal();
      const connection = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(connection);

      const contract = fetchContract(provider);

      const data = await contract.fetchMarketItems();

      const items = await Promise.all(
        data.map(
          async ({ tokenId, seller, owner, price: unformattedPrice }) => {
            const tokenURI = await contract.tokenURI(tokenId);

            const {
              data: { image, name, description },
            } = await axios.get(tokenURI, {});
            const price = ethers.utils.formatUnits(
              unformattedPrice.toString(),
              "ether"
            );

            return {
              price,
              tokenId: tokenId.toNumber(),
              seller,
              owner,
              image,
              name,
              description,
              tokenURI,
            };
          }
        )
      );
      return items;

      // }
    } catch (error) {
      // setError("Error while fetching NFTS");
      // setOpenError(true);
      console.log("Error while fetching NFT");
    }
  };

  useEffect(() => {
    fetchNFTs();
  }, []);

    //--FETCHING MY NFT OR LISTED NFTs
  const fetchMyNFTsOrListedNFTs = async (type) => {
    try {
      if (currentAccount) {
        const contract = await connectingWithSmartContract();

        const data =
          type == "fetchItemsListed"
            ? await contract.fetchItemsListed()
            : await contract.fetchMyNFTs();

        const items = await Promise.all(
          data.map(
            async ({ tokenId, seller, owner, price: unformattedPrice }) => {
              const tokenURI = await contract.tokenURI(tokenId);
              const {
                data: { image, name, description },
              } = await axios.get(tokenURI);
              const price = ethers.utils.formatUnits(
                unformattedPrice.toString(),
                "ether"
              );

              return {
                price,
                tokenId: tokenId.toNumber(),
                seller,
                owner,
                image,
                name,
                description,
                tokenURI,
              };
            }
          )
        );
        return items;
      }
    } catch (error) {
      // setError("Error while fetching listed NFTs");
      // setOpenError(true);
      console.log("Error fetching listed NFT")
    }
  };

  // useEffect(() => {
  //   fetchMyNFTsOrListedNFTs();
  // }, []);

    //---BUY NFTs FUNCTION
  const buyNFT = async (nft) => {
    try {
      const contract = await connectingWithSmartContract();
      const price = ethers.utils.parseUnits(nft.price.toString(), "ether");

      const transaction = await contract.createMarketSale(nft.tokenId, {
        value: price,
      });

      await transaction.wait();
      //router.push("/author");
    } catch (error) {
      console.log("Error While buying NFT");
      //setOpenError(true);
    }
  };
  return (
    <NFTMarketplaceContext.Provider value={{ 
        checkIfWalletConnected,
        connectWallet,
        uploadToIPFS,
        createNFT,
        fetchNFTs,
        fetchMyNFTsOrListedNFTs,
        buyNFT,
        createSale,
        currentAccount, 
        titleData, 
        }}>
        {children}
    </NFTMarketplaceContext.Provider>
  )
}