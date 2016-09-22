'use strict';

import React, { Component } from 'react';

import {
  LayoutAnimation,
  StyleSheet,
  ScrollView,
  AppState,
  Platform,
  Linking,
  Share,
  Alert,
  Modal,
  Image,
  View,
  Text,
} from 'react-native';

import DeviceInfo from 'react-native-device-info';
import AV from 'leancloud-storage';
import SplashScreen from 'rn-splash-screen';

import {
  Size,
  CellSize,
  BoardWidth,

  Board,
  Puzzle,
  Timer,
  Touchable,
} from '../components';
import {
  Store,
  sudoku,
  I18n,
} from '../utils';

const formatTime = Timer.formatTime;
const Score = AV.Object.extend('Score');

function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day == 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff);
}

function initScore(puzzle) {
  return {
    elapsed: null,
    puzzle: puzzle ? puzzle.slice() : null,
    solve: null,
    steps: [],
    errors: [],
    time: null,
  };
}

class Main extends Component {
  state = {
    puzzle: null,
    playing: false,
    initing: false,
    editing: false,
    fetching: false,
    showModal: false,
    showChallenge: false,
    showRecord: false,
    showOnline: false,
  }
  score = initScore()
  fromStore = false
  scores = []
  granted = false
  nextPuzzle = null
  records = []
  challenges = []

  handeleAppStateChange = (currentAppState) => {
    if (currentAppState != 'active') this.onShowModal();
  }

  async componentDidMount() {
    AppState.addEventListener('change', this.handeleAppStateChange);
    this.scores = await Store.get('scores') || [];
    if (this.scores.length) {
      const weekStart = getStartOfWeek();
      this.scores = this.scores.filter(x => new Date(x.time) > weekStart);
      Store.set('scores', this.scores);
    }
    const score = await Store.get('score');
    if (score) {
      this.fromStore = true;
      this.score = score;
    }
    this.setState({
      showModal: true,
    }, () => {
      this.nextPuzzle = sudoku.makepuzzle();
      setTimeout(SplashScreen.hide, 300);
    });
    this.granted = await Store.get('granted');
  }

  componentWillUnmount() {
    AppState.removeEventListener('change', this.handeleAppStateChange);
  }

  render() {
    const { puzzle, playing, initing, editing, showModal, showChallenge, showRecord, showOnline, fetching } = this.state;
    const disabled = !playing && !this.fromStore;
    if (puzzle && !this.score.solve) this.score.solve = puzzle.slice();
    const challengeHeight = showChallenge ? 180 : 0;
    const recordHeight = showRecord ? CellSize / 3 + CellSize * (this.scores.length + 1) : 0;
    const onlineHeight = showOnline ? CellSize / 3 + CellSize * (this.records.length + 1) : 0;
    return (
      <View style={styles.container} >
        <View style={styles.header} >
          <Touchable disabled={initing} onPress={this.onShowModal} >
            <Image style={[styles.icon, initing && styles.disabled]} source={require('../images/menu.png')} />
          </Touchable>
          <Timer ref={ref => this.timer = ref} style={styles.timer} disabledStyle={styles.disabled} />
          <Touchable disabled={!playing} onPress={this.onToggleEditing} >
            <Image style={[styles.icon, editing&&{tintColor: 'khaki'}, !playing && styles.disabled]} source={require('../images/edit.png')} />
          </Touchable>
        </View>
        <Board puzzle={puzzle} solve={this.score.solve} editing={editing} 
          onInit={this.onInit} onMove={this.onMove} onErrorMove={this.onErrorMove} onFinish={this.onFinish} />
        <Modal animationType='slide' visible={showModal} transparent={true} onRequestClose={this.onCloseModal} >
          <View style={styles.modal} >
            <View style={[styles.modalContainer, {marginTop: showOnline? -onlineHeight:0}]} >
              {!showChallenge&&!showRecord&&<Text style={styles.title} >{I18n.t('name')}</Text>}
              <Touchable disabled={disabled} style={styles.button} onPress={this.onResume} >
                <Image style={[styles.buttonIcon, disabled && styles.disabled]} source={require('../images/play.png')} />
                <Text style={[styles.buttonText, disabled && styles.disabled]} >{I18n.t('continue')}</Text>
              </Touchable>
              <Touchable disabled={disabled} style={styles.button} onPress={this.onClear} >
                <Image style={[styles.buttonIcon, disabled && styles.disabled]} source={require('../images/reload.png')} />
                <Text style={[styles.buttonText, disabled && styles.disabled]} >{I18n.t('restart')}</Text>
              </Touchable>
              <Touchable style={styles.button} onPress={this.onCreate} >
                <Image style={styles.buttonIcon} source={require('../images/shuffle.png')} />
                <Text style={styles.buttonText} >{I18n.t('newgame')}</Text>
              </Touchable>
              <Touchable style={styles.button} onPress={this.onToggleChallenge} >
                <Image style={styles.buttonIcon} source={require('../images/challenge.png')} />
                <Text style={styles.buttonText} >{I18n.t('challenge')}</Text>
              </Touchable>
              <View style={{overflow: 'hidden', height: challengeHeight}} >
                <ScrollView 
                  horizontal={true} 
                  showsHorizontalScrollIndicator={false}
                  style={styles.challenge} 
                  contentContainerStyle={styles.challengeContainer} >
                  {this.challenges.map((item, idx) => (
                    <Puzzle key={idx} puzzle={item.get('puzzle')} elapsed={item.get('elapsed')} onPress={this.onChallenge} />
                  ))}
                </ScrollView>
                <View style={styles.triangle} />
              </View>
              <Touchable style={styles.button} onPress={this.onToggleRecord} >
                <Image style={styles.buttonIcon} source={require('../images/rank.png')} />
                <Text style={styles.buttonText} >{I18n.t('weekrank')}</Text>
              </Touchable>
              <View style={{overflow: 'hidden', height: recordHeight}} >
                <Touchable style={styles.record} onPress={this.onToggleRecord} >
                  <View style={styles.triangle} />
                  {this.scores.length > 0?
                    (this.scores.map((item, idx) => <Text key={idx} style={styles.recordText} >{formatTime(item.elapsed)}</Text>)):
                    <Text style={styles.recordText} >{I18n.t('norecord')}</Text>
                  }
                </Touchable>
                {showRecord&&<Text style={styles.recordText} onPress={this.onToggleOnline} >{I18n.t('onlinerank')}</Text>}
              </View>
              <View style={{overflow: 'hidden', height: onlineHeight}} >
                {!!this.records && this.records.length > 0 &&
                  <Touchable style={styles.record} onPress={this.onToggleOnline} >
                    <View style={styles.triangle} />
                    {this.records.map((item, idx) => 
                      <Text key={idx} style={[styles.recordText, (idx + 1 == this.rank)&&styles.highlightText]} >{formatTime(item.get('elapsed'))}</Text>)
                    }
                  </Touchable>
                }
                {!!this.rank&&
                  <Text style={styles.recordText} onPress={this.onToggleOnline} >{I18n.t('rank', {rank: this.rank})}</Text>
                }
              </View>
            </View>
            {fetching&&
              <View style={styles.loading}>
                <Text style={[styles.recordText, styles.highlightText]} >{I18n.t('loading')}</Text>
              </View>
            }
            <View style={styles.footer} >
              <Touchable style={styles.button} onPress={this.onShare} >
                <Image style={[styles.buttonIcon, styles.disabled]} source={require('../images/share.png')} />
              </Touchable>
              <Touchable style={styles.button} onPress={this.onRate} >
                <Image style={[styles.buttonIcon, styles.disabled]} source={require('../images/rate.png')} />
              </Touchable>
              <Touchable style={styles.button} onPress={this.onCloseModal} >
                <Image style={[styles.buttonIcon, styles.disabled]} source={require('../images/close.png')} />
              </Touchable>
              <Touchable style={styles.button} onPress={this.onDonate} >
                <Image style={[styles.buttonIcon, styles.disabled]} source={require('../images/coffee.png')} />
              </Touchable>
              <Touchable style={styles.button} onPress={this.onFeedback} >
                <Image style={[styles.buttonIcon, styles.disabled]} source={require('../images/mail.png')} />
              </Touchable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  onInit = () => {
    this.setState({
      initing: false,
      playing: true,
      showModal: false,
      showChallenge: false,
      showRecord: false,
      showOnline: false,
    });
    this.timer.start();
  }

  onMove = (index, number) => {
    this.score.solve[index] = number;
    const elapsed = this.timer.getElapsed();
    if (elapsed == 0 && this.score.steps.length) {
      this.onShowModal();
      return;
    }
    this.score.steps.push({
      index,
      number,
      elapsed,
    });
  }

  onErrorMove = (index, number) => {
    this.score.errors.push({
      index,
      number,
      elapsed: this.timer.getElapsed(),
    });
    const message = this.score.errors.length > 3 ? I18n.t('fail') : I18n.t('errormove', { error: this.score.errors.length });
    Alert.alert(I18n.t('nosolve'), message, [
      { text: I18n.t('ok') },
      { text: I18n.t('newgame'), onPress: this.onCreate },
    ]);
  }

  onFinish = () => {
    this.setState({
      playing: false,
    });
    this.fromStore = false;
    const elapsed = this.timer.stop();
    this.score.elapsed = elapsed;
    if (this.score.errors.length > 3) {
      setTimeout(() => {
        Alert.alert(I18n.t('congrats'), I18n.t('success') + formatTime(elapsed) + '\n' + I18n.t('fail'), [
          { text: I18n.t('ok') },
          { text: I18n.t('newgame'), onPress: this.onCreate },
        ]);
        this.score = initScore();
      }, 2000);
      return;
    }
    this.score.time = new Date();
    this.scores.push(this.score);
    this.scores.sort((a, b) => a.elapsed - b.elapsed);
    this.scores = this.scores.slice(0, 5);
    Store.set('scores', this.scores);
    Store.remove('score');
    this.score = initScore();

    const newRecord = elapsed == this.scores[0].elapsed && this.scores.length > 1;
    setTimeout(() => {
      Alert.alert(I18n.t('congrats'), (newRecord ? I18n.t('newrecord') : I18n.t('success')) + formatTime(elapsed), [
        { text: I18n.t('ok') },
        { text: I18n.t('newgame'), onPress: this.onCreate },
      ]);
    }, 2000);
  }

  onToggleEditing = () => {
    this.setState({
      editing: !this.state.editing,
    });
  }

  onResume = () => {
    if (this.fromStore) {
      this.timer.setElapsed(this.score.elapsed);
      this.setState({
        puzzle: this.score.puzzle,
        initing: true,
        showChallenge: false,
        showModal: false,
        showRecord: false,
      });
      this.fromStore = false;
      return;
    }
    this.timer.resume();
    this.setState({
      showModal: false,
      showChallenge: false,
      showRecord: false,
    });
  }

  setup(puzzle) {
    this.score = initScore(puzzle);
    Store.set('score', this.score);
    this.fromStore = false;
    this.timer.reset();

    this.setState({
      puzzle,
      initing: true,
      editing: false,
      playing: false,
      showModal: false,
      showChallenge: false,
      showRecord: false,
      showOnline: false,
    });
  }

  onClear = () => {
    const puzzle = this.score.puzzle.slice();
    this.setup(puzzle);
  }

  onCreate = () => {
    let puzzle;
    if (this.nextPuzzle) {
      puzzle = this.nextPuzzle.slice();
      this.nextPuzzle = null;
    } else {
      puzzle = sudoku.makepuzzle();
    }
    this.setup(puzzle);
  }

  onChallenge = (puzzle) => {
    puzzle = puzzle.slice();
    this.setup(puzzle);
  }

  onToggleChallenge = async() => {
    if (!this.state.showChallenge && !this.challenges.length) {
      try {
        LayoutAnimation.easeInEaseOut();
        this.setState({
          fetching: true,
        });
        let query = new AV.Query('Score');
        query = new AV.Query('Score');
        query.ascending('elapsed');
        query.greaterThan('time', getStartOfWeek());
        query.limit(10);
        this.challenges = await query.find();
        this.setState({
          fetching: false,
        });
      } catch (e) {
        this.setState({
          fetching: false,
        });
        Alert.alert(I18n.t('error'), e.message || I18n.t('queryerror'), [
          { text: I18n.t('ok') },
        ]);
        return;
      }
    }
    LayoutAnimation.easeInEaseOut();
    this.setState({
      showChallenge: !this.state.showChallenge,
      showRecord: false,
      showOnline: false,
    });
  }

  onToggleRecord = () => {
    LayoutAnimation.easeInEaseOut();
    this.setState({
      showChallenge: false,
      showRecord: !this.state.showRecord,
      showOnline: this.state.showRecord ? false : this.state.showOnline,
    });
  }

  onToggleOnline = async() => {
    if (!this.granted) {
      const upload = await new Promise((resolve, reject) => {
        Alert.alert(I18n.t('uploadrecord'), I18n.t('uploadmessage'), [{
          text: I18n.t('reject'),
          onPress: () => {
            resolve(false);
          },
        }, {
          text: I18n.t('grant'),
          onPress: () => {
            resolve(true);
          },
        }]);
      });
      if (!upload) return;
      this.granted = true;
      Store.set('granted', true);
    }
    if (!this.state.showOnline) {
      try {
        this.records = null;
        this.rank = null;
        LayoutAnimation.easeInEaseOut();
        this.setState({
          fetching: true,
        });
        let query = new AV.Query('Score');
        query.equalTo('uid', DeviceInfo.getUniqueID());
        let score = await query.first();
        if (!score || score.get('elapsed') > this.scores[0].elapsed) {
          if (!score) score = new Score();
          else score = AV.Object.createWithoutData('Score', score.id);
          const best = this.scores[0];
          score.set('elapsed', best.elapsed);
          score.set('puzzle', best.puzzle);
          score.set('solve', best.solve);
          score.set('steps', best.steps);
          score.set('errors', best.errors);
          score.set('time', new Date(best.time));
          score.set('uid', DeviceInfo.getUniqueID());
          score.set('model', DeviceInfo.getModel());
          score.set('device', DeviceInfo.getDeviceName());
          const result = await score.save();
          if (!result || !result.id) {
            this.setState({
              fetching: false,
            });
            Alert.alert(I18n.t('error'), I18n.t('uploaderror'), [
              { text: I18n.t('ok') },
            ]);
            return;
          }
        }
        query = new AV.Query('Score');
        query.ascending('elapsed');
        query.greaterThan('time', getStartOfWeek());
        query.limit(10);
        this.records = await query.find();
        this.challenges = this.records.slice();
        query = new AV.Query('Score');
        query.greaterThan('time', getStartOfWeek());
        query.lessThan('elapsed', this.scores[0].elapsed);
        this.rank = await query.count();
        this.rank = this.rank + 1;
        this.setState({
          fetching: false,
        });
      } catch (e) {
        this.setState({
          fetching: false,
        });
        Alert.alert(I18n.t('error'), e.message || I18n.t('queryerror'), [
          { text: I18n.t('ok') },
        ]);
        return;
      }
    }
    LayoutAnimation.easeInEaseOut();
    this.setState({
      showOnline: !this.state.showOnline,
    });
  }

  onShowModal = () => {
    if (!this.state.initing && this.score.puzzle) {
      this.score.elapsed = this.timer.pause();
      Store.set('score', this.score);
    }
    this.setState({
      showModal: true,
      showChallenge: false,
      showRecord: false,
    }, () => {
      if (!this.nextPuzzle) this.nextPuzzle = sudoku.makepuzzle();
    });
  }

  onCloseModal = () => {
    this.timer.resume();
    this.setState({
      showChallenge: false,
      showRecord: false,
      showOnline: false,
    }, () => {
      requestAnimationFrame(() => {
        this.setState({
          showModal: false,
        });
      });
    });
  }

  onShare = () => {
    const url = 'http://a.app.qq.com/o/simple.jsp?pkgname=com.liteneo.sudoku';
    let message = I18n.t('sharemessage');
    if (Platform.OS == 'android') message = message + ' \n' + url;
    Share.share({
      url,
      message,
      title: I18n.t('share'),
    }, {
      dialogTitle: I18n.t('share'),
    }).catch(error => {
      Alert.alert(I18n.t('error'), I18n.t('sharefailed'), [
        { text: I18n.t('ok') },
      ]);
    });
  }

  onRate = () => {
    const link = Platform.OS == 'android' ?
      'market://details?id=com.liteneo.sudoku' :
      'itms-apps://itunes.apple.com/cn/app/id1138612488?mt=8';
    Alert.alert(I18n.t('rate'), I18n.t('ratemessage'), [
      { text: I18n.t('confirm'), onPress: () => Linking.openURL(link) },
      { text: I18n.t('cancel') },
    ]);
  }

  onFeedback = () => {
    Linking.openURL('mailto:nihgwu@live.com');
  }

  onDonate = async() => {
    const link = 'alipayqr://platformapi/startapp?saId=10000007&qrcode=https%3A%2F%2Fqr.alipay.com%2Ffkx0411648nxwd5in3vj578';
    const isInstalled = await Linking.canOpenURL(link);
    if (!isInstalled) {
      Alert.alert(I18n.t('thanks'), I18n.t('noalipay'), [
        { text: I18n.t('ok') },
      ]);
      return;
    }
    Linking.openURL(link);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'cadetblue',
    paddingBottom: CellSize,
  },
  header: {
    width: BoardWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    width: CellSize,
    height: CellSize,
  },
  timer: {
    fontSize: CellSize * 3 / 4,
    alignSelf: 'center',
    color: '#fff',
    opacity: 1,
  },
  modal: {
    flex: 1,
    backgroundColor: 'teal',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  editing: {
    tintColor: 'khaki',
    opacity: 1,
  },
  title: {
    marginTop: 30,
    marginBottom: 10,
    textAlign: 'center',
    fontSize: CellSize,
    color: '#fff',
    //fontFamily: 'Menlo',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  button: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    width: CellSize,
    height: CellSize,
  },
  buttonText: {
    marginLeft: CellSize / 2,
    color: '#fff',
    fontSize: CellSize * 3 / 4,
    fontFamily: 'Menlo',
  },
  challenge: {
    flex: 1,
    backgroundColor: 'cadetblue',
    borderColor: 'darkcyan',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  challengeContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: {
    backgroundColor: 'cadetblue',
    paddingVertical: CellSize / 6,
    borderColor: 'darkcyan',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordText: {
    height: CellSize * 4 / 6,
    marginVertical: CellSize / 6,
    textAlign: 'center',
    color: '#fff',
    fontFamily: 'Menlo',
    fontSize: CellSize * 2 / 4,
    lineHeight: Platform.OS == 'android' ? Math.floor(CellSize * 4 / 6) : CellSize * 4 / 6,
  },
  highlightText: {
    color: 'khaki',
  },
  triangle: {
    position: 'absolute',
    left: Size.width / 2 - CellSize / 3 / 2,
    top: -CellSize / 3 / 2,
    width: CellSize / 3,
    height: CellSize / 3,
    backgroundColor: 'teal',
    borderColor: 'darkcyan',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    transform: [{
      rotate: '45deg',
    }],
  },
  loading: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: CellSize * 3 / 2,
    alignItems: 'center',
  }
});


export default Main;
